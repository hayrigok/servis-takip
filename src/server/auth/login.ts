import { and, eq, sql } from 'drizzle-orm';
import { foldIdentifier } from '@/lib/identifier';
import { recordAudit } from '@/server/audit/audit';
import type { Clock } from '@/server/clock';
import type { Db } from '@/server/db/pool';
import { users } from '@/server/db/schema';
import { withTenant } from '@/server/db/tenant';
import { findTenantByCode } from '@/server/platform/tenants';
import { z } from '@/server/validation';
import { dummyVerify, verifyPassword } from './password';
import { PASSWORD_MAX_LENGTH } from './password-policy';
import type { FailureLimiter } from './rate-limit';
import { createSession } from './session';

export const LOCK_THRESHOLD = 5;
export const LOCK_DURATION_MS = 15 * 60_000;

export const LOGIN_MESSAGES = {
  invalid: 'Firma kodu, kullanıcı adı ya da şifre hatalı.',
  tooManyFromIp: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.',
  locked: (minutes: number) =>
    `Bu hesap çok fazla hatalı deneme nedeniyle kilitlendi. ${minutes} dakika sonra tekrar deneyin.`,
  inactive: 'Bu hesap kullanıma kapalı. Firmanızın yöneticisiyle görüşün.',
  tenantSuspended: 'Firmanızın hesabı şu an kullanıma kapalı.',
} as const;

const loginInputSchema = z.object({
  tenantCode: z.string().max(100),
  username: z.string().max(100),
  password: z.string().max(PASSWORD_MAX_LENGTH * 4),
});

export interface LoginEnv {
  ip: string;
  clock: Clock;
  limiter: FailureLimiter;
}

export type LoginResult =
  | {
      ok: true;
      token: string;
      expiresAt: Date;
      tenantId: string;
      tenantCode: string;
      mustChangePassword: boolean;
    }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

type Outcome =
  | { kind: 'invalid' }
  | { kind: 'locked'; minutes: number }
  | { kind: 'inactive' }
  | { kind: 'suspended' }
  | {
      kind: 'success';
      token: string;
      expiresAt: Date;
      mustChangePassword: boolean;
      tenantId: string;
      tenantCode: string;
    };

export async function login(db: Db, raw: unknown, env: LoginEnv): Promise<LoginResult> {
  const parsed = loginInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: LOGIN_MESSAGES.invalid };

  const fieldErrors: Record<string, string> = {};
  if (!parsed.data.tenantCode.trim()) fieldErrors.tenantCode = 'Firma kodunu yazın.';
  if (!parsed.data.username.trim()) fieldErrors.username = 'Kullanıcı adınızı yazın.';
  if (!parsed.data.password) fieldErrors.password = 'Şifrenizi yazın.';
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: 'Eksik alanları doldurun.', fieldErrors };
  }

  const now = env.clock.now();
  if (env.limiter.isBlocked(env.ip, now)) {
    return { ok: false, message: LOGIN_MESSAGES.tooManyFromIp };
  }
  // Deneme, sonucu beklenmeden başarısız sayılır: aynı anda gelen istekler IP sınırını aşamaz.
  // Başarısız olmayan deneme (doğru şifre ya da sunucu hatası) aşağıda geri alınır.
  env.limiter.recordFailure(env.ip, now);

  const credentials = {
    tenantCode: foldIdentifier(parsed.data.tenantCode),
    username: foldIdentifier(parsed.data.username),
    // Şifre olduğu gibi kullanılır: kırpılmaz, sadeleştirilmez.
    password: parsed.data.password,
  };
  const outcome = await checkCredentials(db, credentials, env.clock, now).catch((err: unknown) => {
    env.limiter.forgive(env.ip, now);
    throw err;
  });

  switch (outcome.kind) {
    case 'success':
      env.limiter.forgive(env.ip, now);
      return {
        ok: true,
        token: outcome.token,
        expiresAt: outcome.expiresAt,
        tenantId: outcome.tenantId,
        tenantCode: outcome.tenantCode,
        mustChangePassword: outcome.mustChangePassword,
      };
    case 'inactive':
      env.limiter.forgive(env.ip, now);
      return { ok: false, message: LOGIN_MESSAGES.inactive };
    case 'suspended':
      env.limiter.forgive(env.ip, now);
      return { ok: false, message: LOGIN_MESSAGES.tenantSuspended };
    case 'locked':
      return { ok: false, message: LOGIN_MESSAGES.locked(outcome.minutes) };
    case 'invalid':
      return { ok: false, message: LOGIN_MESSAGES.invalid };
  }
}

async function checkCredentials(
  db: Db,
  input: { tenantCode: string; username: string; password: string },
  clock: Clock,
  now: Date,
): Promise<Outcome> {
  const tenant = await findTenantByCode(db, input.tenantCode);
  if (!tenant) {
    await dummyVerify(input.password);
    return { kind: 'invalid' };
  }

  return withTenant(db, tenant.id, async (tx): Promise<Outcome> => {
    const byUser = (id: string) => and(eq(users.tenantId, tenant.id), eq(users.id, id));
    // Satır işlem bitene kadar kilitli kalır: aynı hesaba aynı anda gelen denemeler sırayla işlenir
    // ve hesabı kilitleyen denemeden sonrakiler kilidi görür (5 deneme sınırı aşılamaz).
    const [user] = await tx
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
        lockedUntil: users.lockedUntil,
        mustChangePassword: users.mustChangePassword,
      })
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.username, input.username)))
      .limit(1)
      .for('update');

    if (!user) {
      await dummyVerify(input.password);
      return { kind: 'invalid' };
    }
    if (user.lockedUntil && user.lockedUntil > now) {
      return {
        kind: 'locked',
        minutes: Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000),
      };
    }

    if (!(await verifyPassword(user.passwordHash, input.password))) {
      const [updated] = await tx
        .update(users)
        .set({ failedAttempts: sql`${users.failedAttempts} + 1`, updatedAt: now })
        .where(byUser(user.id))
        .returning({ failedAttempts: users.failedAttempts });
      if ((updated?.failedAttempts ?? 0) >= LOCK_THRESHOLD) {
        await tx
          .update(users)
          .set({
            failedAttempts: 0,
            lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
            updatedAt: now,
          })
          .where(byUser(user.id));
        await recordAudit(tx, {
          tenantId: tenant.id,
          actorUserId: null,
          action: 'auth.locked',
          targetUserId: user.id,
          at: now,
        });
        return { kind: 'locked', minutes: LOCK_DURATION_MS / 60_000 };
      }
      return { kind: 'invalid' };
    }

    if (!user.isActive) return { kind: 'inactive' };
    if (tenant.status !== 'active') return { kind: 'suspended' };

    await tx
      .update(users)
      .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: now, updatedAt: now })
      .where(byUser(user.id));
    const session = await createSession(tx, { id: user.id, tenantId: tenant.id }, clock);
    await recordAudit(tx, {
      tenantId: tenant.id,
      actorUserId: user.id,
      action: 'auth.login',
      targetUserId: user.id,
      at: now,
    });
    return {
      kind: 'success',
      ...session,
      mustChangePassword: user.mustChangePassword,
      tenantId: tenant.id,
      tenantCode: tenant.code,
    };
  });
}

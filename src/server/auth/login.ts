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
  | { kind: 'success'; token: string; expiresAt: Date; mustChangePassword: boolean };

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

  const tenantCode = foldIdentifier(parsed.data.tenantCode);
  const username = foldIdentifier(parsed.data.username);
  // Şifre olduğu gibi kullanılır: kırpılmaz, sadeleştirilmez.
  const password = parsed.data.password;

  const tenant = await findTenantByCode(db, tenantCode);
  let outcome: Outcome;
  if (!tenant) {
    await dummyVerify(password);
    outcome = { kind: 'invalid' };
  } else {
    outcome = await withTenant(db, tenant.id, async (tx): Promise<Outcome> => {
      const byUser = (id: string) => and(eq(users.tenantId, tenant.id), eq(users.id, id));
      const [user] = await tx
        .select({
          id: users.id,
          passwordHash: users.passwordHash,
          isActive: users.isActive,
          lockedUntil: users.lockedUntil,
          mustChangePassword: users.mustChangePassword,
        })
        .from(users)
        .where(and(eq(users.tenantId, tenant.id), eq(users.username, username)))
        .limit(1);

      if (!user) {
        await dummyVerify(password);
        return { kind: 'invalid' };
      }
      if (user.lockedUntil && user.lockedUntil > now) {
        return {
          kind: 'locked',
          minutes: Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000),
        };
      }

      if (!(await verifyPassword(user.passwordHash, password))) {
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
      const session = await createSession(tx, { id: user.id, tenantId: tenant.id }, env.clock);
      await recordAudit(tx, {
        tenantId: tenant.id,
        actorUserId: user.id,
        action: 'auth.login',
        targetUserId: user.id,
        at: now,
      });
      return { kind: 'success', ...session, mustChangePassword: user.mustChangePassword };
    });
  }

  switch (outcome.kind) {
    case 'success':
      return {
        ok: true,
        token: outcome.token,
        expiresAt: outcome.expiresAt,
        tenantId: tenant!.id,
        tenantCode: tenant!.code,
        mustChangePassword: outcome.mustChangePassword,
      };
    case 'inactive':
      return { ok: false, message: LOGIN_MESSAGES.inactive };
    case 'suspended':
      return { ok: false, message: LOGIN_MESSAGES.tenantSuspended };
    case 'locked':
      env.limiter.recordFailure(env.ip, now);
      return { ok: false, message: LOGIN_MESSAGES.locked(outcome.minutes) };
    case 'invalid':
      env.limiter.recordFailure(env.ip, now);
      return { ok: false, message: LOGIN_MESSAGES.invalid };
  }
}

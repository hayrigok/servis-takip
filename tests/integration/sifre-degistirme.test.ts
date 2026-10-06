import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { changePassword } from '@/server/auth/change-password';
import { login } from '@/server/auth/login';
import { verifyPassword } from '@/server/auth/password';
import { createFailureLimiter } from '@/server/auth/rate-limit';
import {
  createSession,
  encodeSessionCookie,
  hashSessionToken,
  validateSession,
} from '@/server/auth/session';
import { auditLog, users, type UserRow } from '@/server/db/schema';
import { withTenant } from '@/server/db/tenant';
import { AppError } from '@/server/errors';
import { createFakeClock } from '../helpers/clock';
import { useTestDbs } from '../helpers/db';
import { actorFor, seedTenant, seedUser, type SeededTenant } from '../helpers/fabrika';

const OLD = 'abcd-efgh-jkmn';
const NEW = 'Kombi Tamir 42';

describe('şifre belirleme ve değiştirme', () => {
  const { app, owner } = useTestDbs();
  const clock = createFakeClock();
  let tenant: SeededTenant;
  let user: UserRow;

  beforeEach(async () => {
    tenant = await seedTenant(owner);
    user = await seedUser(owner, tenant.id, {
      username: 'ayse',
      password: OLD,
      mustChangePassword: true,
    });
  });

  async function openSessions(count: number): Promise<string[]> {
    const tokens: string[] = [];
    for (let i = 0; i < count; i++) {
      const { token } = await withTenant(app, tenant.id, async (tx) =>
        createSession(tx, { id: user.id, tenantId: tenant.id }, clock),
      );
      tokens.push(token);
    }
    return tokens;
  }

  const run = (raw: unknown, requireCurrent: boolean, sessionId: string | null = null) =>
    withTenant(app, tenant.id, async (tx) =>
      changePassword(tx, actorFor(user, tenant.code, sessionId), raw, { requireCurrent, clock }),
    );

  const fieldErrorsOf = async (promise: Promise<unknown>) => {
    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    return (err as AppError).fieldErrors ?? {};
  };

  it('ilk girişte şifre belirler, zorunluluğu kaldırır, diğer oturumları kapatır', async () => {
    const [current, other] = await openSessions(2);
    await run({ newPassword: NEW, confirmPassword: NEW }, false, hashSessionToken(current!));

    const [row] = await withTenant(owner, tenant.id, async (tx) =>
      tx.select().from(users).where(eq(users.id, user.id)),
    );
    expect(row!.mustChangePassword).toBe(false);
    expect(await verifyPassword(row!.passwordHash, NEW)).toBe(true);
    expect(
      await validateSession(app, encodeSessionCookie(tenant.id, current!), clock),
    ).not.toBeNull();
    expect(await validateSession(app, encodeSessionCookie(tenant.id, other!), clock)).toBeNull();

    const audit = await withTenant(owner, tenant.id, async (tx) => tx.select().from(auditLog));
    expect(audit.map((a) => a.action)).toEqual(['user.password_changed']);

    const relogin = await login(
      app,
      { tenantCode: tenant.code, username: 'ayse', password: NEW },
      {
        ip: '203.0.113.9',
        clock,
        limiter: createFailureLimiter({ maxFailures: 20, windowMs: 900_000 }),
      },
    );
    expect(relogin).toMatchObject({ ok: true, mustChangePassword: false });
  });

  it('zorunluluk yokken mevcut şifre sorulmadan değiştirilemez', async () => {
    await run({ newPassword: NEW, confirmPassword: NEW }, false);
    await expect(
      run({ newPassword: 'Başka Şifre 77', confirmPassword: 'Başka Şifre 77' }, false),
    ).rejects.toMatchObject({
      kind: 'forbidden',
    });
  });

  it('gönüllü değişiklikte mevcut şifreyi ister ve denetler', async () => {
    expect(await fieldErrorsOf(run({ newPassword: NEW, confirmPassword: NEW }, true))).toEqual({
      currentPassword: 'Mevcut şifrenizi yazın.',
    });
    expect(
      await fieldErrorsOf(
        run({ currentPassword: 'yanlış', newPassword: NEW, confirmPassword: NEW }, true),
      ),
    ).toEqual({
      currentPassword: 'Mevcut şifre yanlış.',
    });
    await expect(
      run({ currentPassword: OLD, newPassword: NEW, confirmPassword: NEW }, true),
    ).resolves.toBeUndefined();
  });

  it('kural, tekrar ve eski şifre hatalarını alan bazında verir', async () => {
    expect(
      await fieldErrorsOf(run({ newPassword: 'kisa', confirmPassword: 'kisa' }, false)),
    ).toEqual({
      newPassword: 'Şifre en az 8 karakter olmalı.',
    });
    expect(
      await fieldErrorsOf(run({ newPassword: NEW, confirmPassword: `${NEW}x` }, false)),
    ).toEqual({
      confirmPassword: 'Şifreler aynı değil.',
    });
    expect(await fieldErrorsOf(run({ newPassword: OLD, confirmPassword: OLD }, false))).toEqual({
      newPassword: 'Yeni şifre eskisiyle aynı olamaz.',
    });
    expect(
      await fieldErrorsOf(run({ newPassword: 'ayse2026!', confirmPassword: 'ayse2026!' }, false)),
    ).toEqual({
      newPassword: 'Şifre kullanıcı adınızı içeremez.',
    });
  });
});

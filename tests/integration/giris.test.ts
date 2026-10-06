import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { LOGIN_MESSAGES, login, type LoginEnv } from '@/server/auth/login';
import { createFailureLimiter } from '@/server/auth/rate-limit';
import { encodeSessionCookie, validateSession } from '@/server/auth/session';
import { auditLog, tenants, users, type UserRow } from '@/server/db/schema';
import { withTenant } from '@/server/db/tenant';
import { MINUTE, createFakeClock, type FakeClock } from '../helpers/clock';
import { useTestDbs } from '../helpers/db';
import { seedTenant, seedUser, type SeededTenant } from '../helpers/fabrika';

const PASSWORD = 'Doğru Şifre 9';

describe('giriş', () => {
  const { app, owner } = useTestDbs();
  let tenant: SeededTenant;
  let user: UserRow;
  let clock: FakeClock;
  let env: LoginEnv;

  beforeEach(async () => {
    tenant = await seedTenant(owner);
    user = await seedUser(owner, tenant.id, {
      username: 'ismail',
      fullName: 'İsmail Çelik',
      password: PASSWORD,
      mustChangePassword: true,
    });
    clock = createFakeClock();
    env = {
      ip: '203.0.113.5',
      clock,
      limiter: createFailureLimiter({ maxFailures: 20, windowMs: 15 * MINUTE }),
    };
  });

  const attempt = (
    password: string,
    overrides: Partial<{ tenantCode: string; username: string }> = {},
    e = env,
  ) => login(app, { tenantCode: tenant.code, username: 'ismail', password, ...overrides }, e);
  const userRow = async () =>
    (
      await withTenant(owner, tenant.id, async (tx) =>
        tx.select().from(users).where(eq(users.id, user.id)),
      )
    )[0]!;
  const auditActions = async () =>
    (await withTenant(owner, tenant.id, async (tx) => tx.select().from(auditLog))).map(
      (a) => a.action,
    );

  it('doğru bilgilerle oturum açar, ilk girişte şifre belirlemeyi ister', async () => {
    const result = await attempt(PASSWORD);
    expect(result).toMatchObject({
      ok: true,
      tenantId: tenant.id,
      tenantCode: tenant.code,
      mustChangePassword: true,
    });
    if (!result.ok) return;
    const session = await validateSession(
      app,
      encodeSessionCookie(result.tenantId, result.token),
      clock,
    );
    expect(session?.user.id).toBe(user.id);
    expect((await userRow()).lastLoginAt?.getTime()).toBe(clock.now().getTime());
    expect(await auditActions()).toEqual(['auth.login']);
  });

  it('firma kodu ve kullanıcı adındaki Türkçe harf ve büyük harf farkını önemsemez', async () => {
    const result = await attempt(PASSWORD, {
      tenantCode: ` ${tenant.code.toUpperCase()} `,
      username: 'İSMAİL',
    });
    expect(result.ok).toBe(true);
  });

  it('şifre olduğu gibi karşılaştırılır (kırpılmaz, sadeleştirilmez)', async () => {
    const spaced = await seedUser(owner, tenant.id, {
      username: 'bosluklu',
      password: '  Şifre İçin 9  ',
    });
    expect((await attempt('  Şifre İçin 9  ', { username: spaced.username })).ok).toBe(true);
    expect((await attempt('Şifre İçin 9', { username: spaced.username })).ok).toBe(false);
    expect((await attempt('  sifre icin 9  ', { username: spaced.username })).ok).toBe(false);
  });

  it('yanlış şifre, olmayan kullanıcı ve olmayan firma aynı mesajı alır', async () => {
    const expected = { ok: false, message: LOGIN_MESSAGES.invalid };
    expect(await attempt('yanlış')).toEqual(expected);
    expect(await attempt(PASSWORD, { username: 'olmayan' })).toEqual(expected);
    expect(await attempt(PASSWORD, { tenantCode: 'olmayan-firma' })).toEqual(expected);
    expect((await userRow()).failedAttempts).toBe(1);
  });

  it('boş alanlar için alan hatası verir', async () => {
    const result = await login(app, { tenantCode: '', username: ' ', password: '' }, env);
    expect(result).toEqual({
      ok: false,
      message: 'Eksik alanları doldurun.',
      fieldErrors: {
        tenantCode: 'Firma kodunu yazın.',
        username: 'Kullanıcı adınızı yazın.',
        password: 'Şifrenizi yazın.',
      },
    });
  });

  it('5 yanlış denemede hesabı 15 dakika kilitler, süre dolunca açar', async () => {
    for (let i = 0; i < 4; i++) expect((await attempt('yanlış')).ok).toBe(false);
    expect(await attempt('yanlış')).toEqual({ ok: false, message: LOGIN_MESSAGES.locked(15) });
    expect(await auditActions()).toEqual(['auth.locked']);

    expect(await attempt(PASSWORD)).toEqual({ ok: false, message: LOGIN_MESSAGES.locked(15) });
    clock.advance(10 * MINUTE);
    expect(await attempt(PASSWORD)).toEqual({ ok: false, message: LOGIN_MESSAGES.locked(5) });
    clock.advance(5 * MINUTE + 1000);
    expect((await attempt(PASSWORD)).ok).toBe(true);
    expect((await userRow()).failedAttempts).toBe(0);
  });

  it('başarılı giriş yanlış deneme sayacını sıfırlar', async () => {
    await attempt('yanlış');
    await attempt('yanlış');
    await attempt(PASSWORD);
    expect((await userRow()).failedAttempts).toBe(0);
  });

  it('pasif hesap doğru şifreyle özel mesaj, yanlış şifreyle genel mesaj alır', async () => {
    await withTenant(owner, tenant.id, async (tx) => {
      await tx.update(users).set({ isActive: false }).where(eq(users.id, user.id));
    });
    expect(await attempt(PASSWORD)).toEqual({ ok: false, message: LOGIN_MESSAGES.inactive });
    expect(await attempt('yanlış')).toEqual({ ok: false, message: LOGIN_MESSAGES.invalid });
  });

  it('dondurulmuş firma doğru şifreyle özel mesaj, yanlış şifreyle genel mesaj alır', async () => {
    await owner.update(tenants).set({ status: 'suspended' }).where(eq(tenants.id, tenant.id));
    expect(await attempt(PASSWORD)).toEqual({
      ok: false,
      message: LOGIN_MESSAGES.tenantSuspended,
    });
    expect(await attempt('yanlış')).toEqual({ ok: false, message: LOGIN_MESSAGES.invalid });
  });

  it('aynı IP adresinden 20 başarısız denemeden sonra durdurur, başka IP etkilenmez', async () => {
    for (let i = 0; i < 20; i++) await attempt(PASSWORD, { tenantCode: `yok-${i}` });
    expect(await attempt(PASSWORD)).toEqual({ ok: false, message: LOGIN_MESSAGES.tooManyFromIp });
    expect((await attempt(PASSWORD, {}, { ...env, ip: '198.51.100.7' })).ok).toBe(true);
    clock.advance(15 * MINUTE + 1000);
    expect((await attempt(PASSWORD)).ok).toBe(true);
  });

  it('aynı anda gelen yanlış denemeler hesap kilidini aşamaz', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => attempt('yanlış')));
    const messages = results.map((r) => (r.ok ? 'giriş' : r.message));
    expect(messages.filter((m) => m === LOGIN_MESSAGES.invalid)).toHaveLength(4);
    expect(messages.filter((m) => m === LOGIN_MESSAGES.locked(15))).toHaveLength(8);
    expect(await auditActions()).toEqual(['auth.locked']);
    expect(await attempt(PASSWORD)).toEqual({ ok: false, message: LOGIN_MESSAGES.locked(15) });
  });

  it('aynı anda gelen istekler IP sınırını aşamaz', async () => {
    const e = { ...env, limiter: createFailureLimiter({ maxFailures: 3, windowMs: 15 * MINUTE }) };
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => attempt(PASSWORD, { tenantCode: `yok-${i}` }, e)),
    );
    const blocked = results.filter((r) => !r.ok && r.message === LOGIN_MESSAGES.tooManyFromIp);
    expect(blocked).toHaveLength(3);
  });

  it('başarılı girişler IP sınırına sayılmaz', async () => {
    const e = { ...env, limiter: createFailureLimiter({ maxFailures: 2, windowMs: 15 * MINUTE }) };
    for (let i = 0; i < 3; i++) expect((await attempt(PASSWORD, {}, e)).ok).toBe(true);
    expect(e.limiter.isBlocked(e.ip, clock.now())).toBe(false);
  });
});

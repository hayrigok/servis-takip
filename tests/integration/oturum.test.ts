import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SESSION_TTL_MS,
  createSession,
  deleteUserSessions,
  encodeSessionCookie,
  hashSessionToken,
  validateSession,
} from '@/server/auth/session';
import { sessions, tenants, users, type UserRow } from '@/server/db/schema';
import { withTenant } from '@/server/db/tenant';
import { DAY, createFakeClock, type FakeClock } from '../helpers/clock';
import { useTestDbs } from '../helpers/db';
import { seedTenant, seedUser, type SeededTenant } from '../helpers/fabrika';

describe('oturumlar', () => {
  const { app, owner } = useTestDbs();
  let tenant: SeededTenant;
  let user: UserRow;
  let clock: FakeClock;

  beforeEach(async () => {
    tenant = await seedTenant(owner);
    user = await seedUser(owner, tenant.id, { fullName: 'Mehmet Şahin', role: 'technician' });
    clock = createFakeClock();
  });

  const open = () =>
    withTenant(app, tenant.id, async (tx) =>
      createSession(tx, { id: user.id, tenantId: tenant.id }, clock),
    );
  const cookieFor = (token: string) => encodeSessionCookie(tenant.id, token);
  const sessionRows = () =>
    withTenant(owner, tenant.id, async (tx) =>
      tx.select().from(sessions).where(eq(sessions.userId, user.id)),
    );

  it('belirtecin kendisini değil özetini saklar', async () => {
    const { token } = await open();
    const rows = await sessionRows();
    expect(rows.map((r) => r.id)).toEqual([hashSessionToken(token)]);
  });

  it('geçerli oturum kullanıcıyı ve firmayı döndürür', async () => {
    const { token, expiresAt } = await open();
    expect(expiresAt.getTime() - clock.now().getTime()).toBe(SESSION_TTL_MS);
    const session = await validateSession(app, cookieFor(token), clock);
    expect(session).toMatchObject({
      user: {
        id: user.id,
        tenantId: tenant.id,
        fullName: 'Mehmet Şahin',
        role: 'technician',
        fieldWork: true,
      },
      tenant: { id: tenant.id, code: tenant.code },
    });
  });

  it('çerezdeki firma kimliği değiştirilirse oturum bulunmaz', async () => {
    const { token } = await open();
    const other = await seedTenant(owner);
    expect(await validateSession(app, encodeSessionCookie(other.id, token), clock)).toBeNull();
  });

  it('süresi dolan oturum geçersizdir ve silinir', async () => {
    const { token } = await open();
    clock.advance(30 * DAY + 1000);
    expect(await validateSession(app, cookieFor(token), clock)).toBeNull();
    expect(await sessionRows()).toEqual([]);
  });

  it('bitişe 15 günden az kalınca süre yeniden 30 güne uzar', async () => {
    const { token } = await open();
    clock.advance(20 * DAY);
    const session = await validateSession(app, cookieFor(token), clock);
    expect(session!.expiresAt.getTime()).toBe(clock.now().getTime() + SESSION_TTL_MS);
  });

  it('bitişe 15 günden fazla varken süre değişmez', async () => {
    const { token, expiresAt } = await open();
    clock.advance(5 * DAY);
    const session = await validateSession(app, cookieFor(token), clock);
    expect(session!.expiresAt.getTime()).toBe(expiresAt.getTime());
  });

  it('pasif kullanıcının oturumu geçersizdir ve silinir', async () => {
    const { token } = await open();
    await withTenant(owner, tenant.id, async (tx) => {
      await tx.update(users).set({ isActive: false }).where(eq(users.id, user.id));
    });
    expect(await validateSession(app, cookieFor(token), clock)).toBeNull();
    expect(await sessionRows()).toEqual([]);
  });

  it('dondurulmuş firmanın oturumu geçersizdir', async () => {
    const { token } = await open();
    await owner.update(tenants).set({ status: 'suspended' }).where(eq(tenants.id, tenant.id));
    expect(await validateSession(app, cookieFor(token), clock)).toBeNull();
  });

  it('kullanıcının diğer oturumlarını siler, istenen oturumu korur', async () => {
    const first = await open();
    await open();
    await open();
    const removed = await withTenant(app, tenant.id, async (tx) =>
      deleteUserSessions(tx, tenant.id, user.id, hashSessionToken(first.token)),
    );
    expect(removed).toBe(2);
    expect(await validateSession(app, cookieFor(first.token), clock)).not.toBeNull();
  });

  it('yeni oturum açılırken kullanıcının süresi dolmuş eski oturumlarını temizler', async () => {
    await open();
    clock.advance(31 * DAY);
    const fresh = await open();
    const rows = await sessionRows();
    expect(rows.map((r) => r.id)).toEqual([hashSessionToken(fresh.token)]);
  });

  it('kayıt yokken (silinmiş oturum) null döner', async () => {
    const { token } = await open();
    await withTenant(owner, tenant.id, async (tx) => {
      await tx
        .delete(sessions)
        .where(and(eq(sessions.tenantId, tenant.id), eq(sessions.userId, user.id)));
    });
    expect(await validateSession(app, cookieFor(token), clock)).toBeNull();
  });
});

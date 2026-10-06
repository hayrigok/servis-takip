import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { PG_INSUFFICIENT_PRIVILEGE } from '@/server/db/errors';
import { createDb } from '@/server/db/pool';
import { auditLog, sessions, tenants, users, type UserRow } from '@/server/db/schema';
import { withTenant } from '@/server/db/tenant';
import { requireTestEnv, useTestDbs } from '../helpers/db';
import { seedTenant, seedUser, type SeededTenant } from '../helpers/fabrika';
import { expectPgError } from '../helpers/pg';

describe('2. kilit: veritabanı firmaları tek başına ayırır (uygulama filtresi olmadan)', () => {
  const { app, owner } = useTestDbs();
  let a: SeededTenant;
  let b: SeededTenant;
  let aUser: UserRow;
  let bUser: UserRow;

  beforeAll(async () => {
    a = await seedTenant(owner);
    b = await seedTenant(owner);
    aUser = await seedUser(owner, a.id);
    bUser = await seedUser(owner, b.id);
    await seedUser(owner, b.id);
  });

  it('A bağlamında filtresiz sorgu yalnızca A satırlarını döndürür', async () => {
    const rows = await withTenant(app, a.id, async (tx) => tx.select({ id: users.id }).from(users));
    expect(rows).toEqual([{ id: aUser.id }]);
  });

  it('firma bağlamı yokken hiçbir satır görünmez', async () => {
    expect(await app.select({ id: users.id }).from(users)).toEqual([]);
  });

  it('bağlam işlem bitince bağlantıda kalmaz', async () => {
    const single = createDb(requireTestEnv('TEST_DATABASE_URL'), { max: 1 });
    try {
      await withTenant(single, a.id, async (tx) => tx.select({ id: users.id }).from(users));
      expect(await single.select({ id: users.id }).from(users)).toEqual([]);
    } finally {
      await single.$client.end();
    }
  });

  it('başka firmanın kimliğiyle kayıt eklenemez', async () => {
    await expectPgError(
      withTenant(app, a.id, async (tx) => {
        await tx.insert(users).values({
          tenantId: b.id,
          username: 'sizinti',
          fullName: 'Sızıntı',
          role: 'operator',
          passwordHash: 'x',
        });
      }),
      PG_INSUFFICIENT_PRIVILEGE,
    );
  });

  it('başka firmanın kaydı güncellenemez', async () => {
    const updated = await withTenant(app, a.id, async (tx) =>
      tx
        .update(users)
        .set({ fullName: 'Ele geçirildi' })
        .where(eq(users.id, bUser.id))
        .returning({ id: users.id }),
    );
    expect(updated).toEqual([]);
    const [still] = await withTenant(owner, b.id, async (tx) =>
      tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, bUser.id)),
    );
    expect(still?.fullName).toBe(bUser.fullName);
  });

  it('kayıt başka firmaya taşınamaz', async () => {
    await expectPgError(
      withTenant(app, a.id, async (tx) => {
        await tx.update(users).set({ tenantId: b.id }).where(eq(users.id, aUser.id));
      }),
      PG_INSUFFICIENT_PRIVILEGE,
    );
  });

  it('başka firmanın oturumu silinemez', async () => {
    const id = 'b'.repeat(64);
    await withTenant(owner, b.id, async (tx) => {
      await tx.insert(sessions).values({
        id,
        tenantId: b.id,
        userId: bUser.id,
        expiresAt: new Date(Date.now() + 60_000),
      });
    });
    const deleted = await withTenant(app, a.id, async (tx) =>
      tx.delete(sessions).where(eq(sessions.id, id)).returning({ id: sessions.id }),
    );
    expect(deleted).toEqual([]);
  });

  it('uygulama kullanıcısı personel kaydı silemez (pasifleştirme kullanılır)', async () => {
    await expectPgError(
      withTenant(app, a.id, async (tx) => {
        await tx.delete(users).where(eq(users.id, aUser.id));
      }),
      PG_INSUFFICIENT_PRIVILEGE,
    );
  });

  it('işlem geçmişi değiştirilemez ve silinemez', async () => {
    await withTenant(app, a.id, async (tx) => {
      await tx
        .insert(auditLog)
        .values({ tenantId: a.id, actorUserId: aUser.id, action: 'auth.login' });
    });
    await expectPgError(
      withTenant(app, a.id, async (tx) => {
        await tx.update(auditLog).set({ action: 'degistirildi' });
      }),
      PG_INSUFFICIENT_PRIVILEGE,
    );
    await expectPgError(
      withTenant(app, a.id, async (tx) => {
        await tx.delete(auditLog);
      }),
      PG_INSUFFICIENT_PRIVILEGE,
    );
  });

  it('uygulama kullanıcısı firma açamaz', async () => {
    await expectPgError(
      app.insert(tenants).values({ code: 'yetkisiz-firma', name: 'Yetkisiz' }),
      PG_INSUFFICIENT_PRIVILEGE,
    );
  });
});

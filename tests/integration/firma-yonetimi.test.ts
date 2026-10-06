import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { verifyPassword } from '@/server/auth/password';
import { auditLog, sessions, tenants, users } from '@/server/db/schema';
import { withTenant } from '@/server/db/tenant';
import { AppError } from '@/server/errors';
import { createTenantWithOwner, setTenantStatus } from '@/server/platform/admin';
import { findTenantByCode } from '@/server/platform/tenants';
import { createFakeClock } from '../helpers/clock';
import { useTestDbs } from '../helpers/db';
import { seedTenant, seedUser } from '../helpers/fabrika';

const clock = createFakeClock();

function uniqueInput() {
  const suffix = randomUUID().slice(0, 6);
  return {
    code: `Akın-${suffix}`,
    name: 'Akın Servis',
    ownerFullName: 'Ali Kaya',
    ownerUsername: 'Patron',
    suffix,
  };
}

describe('firma açma', () => {
  const { owner, app } = useTestDbs();

  it('firmayı ve geçici şifreli ilk patronu açar, kodu sadeleştirir', async () => {
    const input = uniqueInput();
    const created = await createTenantWithOwner(owner, input, clock);
    expect(created.code).toBe(`akin-${input.suffix}`);
    expect(created.ownerUsername).toBe('patron');

    const [user] = await withTenant(owner, created.tenantId, async (tx) =>
      tx.select().from(users).where(eq(users.id, created.ownerUserId)),
    );
    expect(user).toMatchObject({
      role: 'owner',
      mustChangePassword: true,
      isActive: true,
      fullName: 'Ali Kaya',
    });
    expect(await verifyPassword(user!.passwordHash, created.tempPassword)).toBe(true);

    const audit = await withTenant(owner, created.tenantId, async (tx) =>
      tx.select().from(auditLog),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'user.created',
      actorUserId: null,
      targetId: created.ownerUserId,
    });
  });

  it('uygulama kullanıcısı kodla firmayı bulabilir', async () => {
    const created = await createTenantWithOwner(owner, uniqueInput(), clock);
    expect(await findTenantByCode(app, created.code)).toMatchObject({
      id: created.tenantId,
      status: 'active',
    });
    expect(await findTenantByCode(app, 'olmayan-firma')).toBeNull();
  });

  it('aynı kodla ikinci firmayı reddeder', async () => {
    const input = uniqueInput();
    await createTenantWithOwner(owner, input, clock);
    await expect(createTenantWithOwner(owner, input, clock)).rejects.toMatchObject({
      kind: 'conflict',
      userMessage: 'Bu firma kodu kullanılıyor.',
    });
  });

  it('geçersiz girdide alan hatalarını birlikte verir', async () => {
    const err = await createTenantWithOwner(
      owner,
      { code: '-x', name: '', ownerFullName: 'Ali', ownerUsername: 'a b' },
      clock,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(Object.keys((err as AppError).fieldErrors ?? {}).sort()).toEqual([
      'code',
      'name',
      'ownerUsername',
    ]);
  });
});

describe('firma dondurma', () => {
  const { owner } = useTestDbs();

  it('dondurunca firmanın bütün oturumlarını kapatır, etkinleştirince geri açar', async () => {
    const tenant = await seedTenant(owner);
    const user = await seedUser(owner, tenant.id);
    await withTenant(owner, tenant.id, async (tx) => {
      await tx.insert(sessions).values([
        {
          id: 'a'.repeat(64),
          tenantId: tenant.id,
          userId: user.id,
          expiresAt: new Date(Date.now() + 60_000),
        },
        {
          id: 'c'.repeat(64),
          tenantId: tenant.id,
          userId: user.id,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
    });

    expect(await setTenantStatus(owner, tenant.code.toUpperCase(), 'suspended')).toEqual({
      tenantId: tenant.id,
      sessionsRemoved: 2,
    });
    const [row] = await owner
      .select({ status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, tenant.id));
    expect(row?.status).toBe('suspended');

    await setTenantStatus(owner, tenant.code, 'active');
    const [again] = await owner
      .select({ status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, tenant.id));
    expect(again?.status).toBe('active');
    const left = await withTenant(owner, tenant.id, async (tx) =>
      tx.select().from(sessions).where(eq(sessions.tenantId, tenant.id)),
    );
    expect(left).toEqual([]);
  });

  it('olmayan firma için anlaşılır hata verir', async () => {
    await expect(setTenantStatus(owner, 'olmayan-firma', 'suspended')).rejects.toMatchObject({
      kind: 'not_found',
      userMessage: 'Bu kodla bir firma bulunamadı.',
    });
  });
});

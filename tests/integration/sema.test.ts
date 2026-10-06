import { describe, expect, it } from 'vitest';
import {
  PG_CHECK_VIOLATION,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from '@/server/db/errors';
import { sessions, users } from '@/server/db/schema';
import { withTenant } from '@/server/db/tenant';
import { useTestDbs } from '../helpers/db';
import { seedTenant, seedUser } from '../helpers/fabrika';
import { expectPgError } from '../helpers/pg';

describe('şema kuralları', () => {
  const { owner } = useTestDbs();

  it('kimlikleri uuidv7 ile üretir', async () => {
    const tenant = await seedTenant(owner);
    expect(tenant.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
  });

  it('sadeleştirilmemiş firma kodunu reddeder', async () => {
    await expectPgError(seedTenant(owner, { code: 'Kötü Kod' }), PG_CHECK_VIOLATION);
  });

  it('aynı firma kodu iki kez kullanılamaz', async () => {
    const tenant = await seedTenant(owner);
    await expectPgError(seedTenant(owner, { code: tenant.code }), PG_UNIQUE_VIOLATION);
  });

  it('teknisyende "sahaya çıkar" kapatılamaz', async () => {
    const tenant = await seedTenant(owner);
    await expectPgError(
      withTenant(owner, tenant.id, async (tx) => {
        await tx.insert(users).values({
          tenantId: tenant.id,
          username: 'teknisyen1',
          fullName: 'Mehmet Şahin',
          role: 'technician',
          fieldWork: false,
          passwordHash: 'x',
        });
      }),
      PG_CHECK_VIOLATION,
    );
  });

  it('aynı firmada aynı kullanıcı adı olamaz, başka firmada olabilir', async () => {
    const a = await seedTenant(owner);
    const b = await seedTenant(owner);
    await seedUser(owner, a.id, { username: 'ismail' });
    await expect(seedUser(owner, b.id, { username: 'ismail' })).resolves.toMatchObject({
      username: 'ismail',
    });
    await expectPgError(seedUser(owner, a.id, { username: 'ismail' }), PG_UNIQUE_VIOLATION);
  });

  it('bir kayıt başka firmanın kullanıcısına bağlanamaz (bileşik anahtar)', async () => {
    const a = await seedTenant(owner);
    const b = await seedTenant(owner);
    const bUser = await seedUser(owner, b.id);
    await expectPgError(
      withTenant(owner, a.id, async (tx) => {
        await tx.insert(sessions).values({
          id: 'f'.repeat(64),
          tenantId: a.id,
          userId: bUser.id,
          expiresAt: new Date(Date.now() + 60_000),
        });
      }),
      PG_FOREIGN_KEY_VIOLATION,
    );
  });
});

import { randomUUID } from 'node:crypto';
import { hashPassword } from '@/server/auth/password';
import type { Db } from '@/server/db/pool';
import { tenants, users, type NewUser, type TenantStatus, type UserRow } from '@/server/db/schema';
import { withTenant } from '@/server/db/tenant';

export interface SeededTenant {
  id: string;
  code: string;
}

export async function seedTenant(
  owner: Db,
  overrides: { code?: string; status?: TenantStatus } = {},
): Promise<SeededTenant> {
  const code = overrides.code ?? `t-${randomUUID().slice(0, 8)}`;
  const [row] = await owner
    .insert(tenants)
    .values({ code, name: `Test ${code}`, status: overrides.status ?? 'active' })
    .returning({ id: tenants.id, code: tenants.code });
  return row!;
}

type SeedUserOverrides = Partial<Omit<NewUser, 'tenantId'>> & { password?: string };

export async function seedUser(
  owner: Db,
  tenantId: string,
  overrides: SeedUserOverrides = {},
): Promise<UserRow> {
  const { password, ...rest } = overrides;
  const role = rest.role ?? 'operator';
  const values: NewUser = {
    username: `k${randomUUID().slice(0, 8)}`,
    fullName: 'Deneme Kişi',
    mustChangePassword: false,
    passwordHash: password ? await hashPassword(password) : 'seed-hash',
    ...rest,
    tenantId,
    role,
    fieldWork: role === 'technician' ? true : (rest.fieldWork ?? false),
  };
  return withTenant(owner, tenantId, async (tx) => {
    const [row] = await tx.insert(users).values(values).returning();
    return row!;
  });
}

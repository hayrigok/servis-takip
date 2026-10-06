import { eq } from 'drizzle-orm';
import type { Db } from '@/server/db/pool';
import { tenants, type TenantStatus } from '@/server/db/schema';

export interface TenantRecord {
  id: string;
  code: string;
  name: string;
  status: TenantStatus;
}

/** Girişte, firma bağlamı kurulmadan önce kodla firma bulunur. tenants tablosu kişisel veri içermez. */
export async function findTenantByCode(db: Db, code: string): Promise<TenantRecord | null> {
  const [row] = await db
    .select({ id: tenants.id, code: tenants.code, name: tenants.name, status: tenants.status })
    .from(tenants)
    .where(eq(tenants.code, code))
    .limit(1);
  return row ?? null;
}

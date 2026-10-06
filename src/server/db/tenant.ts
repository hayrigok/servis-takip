import { sql } from 'drizzle-orm';
import type { Db } from './pool';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

declare const tenantScope: unique symbol;

/** Firma bağlamı (app.tenant_id) kurulmuş işlem. Yalnızca enterTenant/withTenant üretir; servisler bunu ister. */
export type TenantTx = Tx & { readonly [tenantScope]: true };

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export async function enterTenant(tx: Tx, tenantId: string): Promise<TenantTx> {
  if (!isUuid(tenantId)) throw new Error('enterTenant: invalid tenant id');
  // is_local = true: ayar işlem bitince düşer, havuza dönen bağlantıda kalmaz.
  await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
  return tx as TenantTx;
}

export function withTenant<T>(
  db: Db,
  tenantId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => fn(await enterTenant(tx, tenantId)));
}

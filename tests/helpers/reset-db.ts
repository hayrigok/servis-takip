import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../../src/server/db/pool';

/** Test veritabanını sıfırlar ve göçleri uygular. Yalnızca servis_takip_test için çağrılır. */
export async function resetTestDatabase(adminUrl: string): Promise<void> {
  if (!new URL(adminUrl).pathname.endsWith('_test')) {
    throw new Error('resetTestDatabase yalnızca adı _test ile biten veritabanında çalışır.');
  }
  const db = createDb(adminUrl, { max: 1 });
  try {
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`create schema public`);
    await migrate(db, { migrationsFolder: 'drizzle' });
    // Yalnızca testte: RLS'yi atlayan rol, 1. kilidin (uygulama filtresi) tek başına koruduğunu kanıtlamak için.
    await db.execute(sql`grant usage on schema public to servis_test_bypass`);
    await db.execute(
      sql`grant select, insert, update, delete on all tables in schema public to servis_test_bypass`,
    );
  } finally {
    await db.$client.end();
  }
}

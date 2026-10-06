import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../src/server/db/pool';
import { loadEnv, requireEnv } from './lib/env';

async function main(): Promise<void> {
  loadEnv();
  const db = createDb(requireEnv('DATABASE_ADMIN_URL'), { max: 1 });
  try {
    await migrate(db, { migrationsFolder: 'drizzle' });
    console.log('Göçler uygulandı.');
  } finally {
    await db.$client.end();
  }
}

main().catch((err: unknown) => {
  console.error('db:migrate başarısız:', err instanceof Error ? err.message : err);
  process.exit(1);
});

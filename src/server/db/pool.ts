import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { logger } from '@/server/logger';
import * as schema from './schema';

export function createDb(connectionString: string, options: { max?: number } = {}) {
  const pool = new Pool({ connectionString, max: options.max ?? 10 });
  // Boştaki bağlantı koparsa süreç çökmesin; kayda yalnızca hata türü yazılır.
  pool.on('error', (err) => logger.error('db_pool_error', err));
  return drizzle({ client: pool, schema });
}

export type Db = ReturnType<typeof createDb>;

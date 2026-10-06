import 'server-only';
import { createDb, type Db } from './pool';

const globalForDb = globalThis as unknown as { servisAppDb?: Db };

/** Next.js tarafının tekil bağlantı havuzu (geliştirmede sıcak yeniden yüklemede çoğalmasın). */
export function getDb(): Db {
  if (!globalForDb.servisAppDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    globalForDb.servisAppDb = createDb(url);
  }
  return globalForDb.servisAppDb;
}

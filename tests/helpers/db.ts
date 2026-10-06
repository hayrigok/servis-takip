import { afterAll } from 'vitest';
import { createDb, type Db } from '@/server/db/pool';

export function requireTestEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} yok. Önce "npm run db:kur" çalıştırın.`);
  return value;
}

export interface TestDbs {
  /** servis_app: uygulamanın gerçek rolü, RLS uygulanır. */
  app: Db;
  /** servis_owner: tablo sahibi; FORCE RLS sayesinde o da firma bağlamına uyar. Test verisi kurmak için. */
  owner: Db;
  /** servis_test_bypass: RLS'yi atlar. Yalnızca 1. kilidin tek başına koruduğunu kanıtlamak için. */
  bypass: Db;
}

export function useTestDbs(): TestDbs {
  const dbs: TestDbs = {
    app: createDb(requireTestEnv('TEST_DATABASE_URL')),
    owner: createDb(requireTestEnv('TEST_DATABASE_ADMIN_URL')),
    bypass: createDb(requireTestEnv('TEST_DATABASE_BYPASS_URL')),
  };
  afterAll(async () => {
    await Promise.all(Object.values(dbs).map((db) => db.$client.end()));
  });
  return dbs;
}

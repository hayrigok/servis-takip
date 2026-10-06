import { resetTestDatabase } from './helpers/reset-db';

export default async function setup(): Promise<void> {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
  if (!adminUrl) throw new Error('TEST_DATABASE_ADMIN_URL yok. Önce "npm run db:kur" çalıştırın.');
  await resetTestDatabase(adminUrl);
}

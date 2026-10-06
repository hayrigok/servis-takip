import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { loadEnv, requireEnv, upsertEnvFile } from './lib/env';

const ROLES = [
  { name: 'servis_owner', passwordKey: 'SERVIS_OWNER_PASSWORD', bypassRls: false },
  { name: 'servis_app', passwordKey: 'SERVIS_APP_PASSWORD', bypassRls: false },
  { name: 'servis_test_bypass', passwordKey: 'SERVIS_TEST_BYPASS_PASSWORD', bypassRls: true },
] as const;

const DATABASES = ['servis_takip', 'servis_takip_test'] as const;

async function main(): Promise<void> {
  loadEnv();
  const superUrl = new URL(requireEnv('PG_SUPERUSER_URL'));
  const host = superUrl.host;

  // Yeniden çalıştırıldığında var olan şifreler korunur.
  const passwords = Object.fromEntries(
    ROLES.map((r) => [r.name, process.env[r.passwordKey] || randomBytes(24).toString('hex')]),
  ) as Record<(typeof ROLES)[number]['name'], string>;

  const client = new Client({ connectionString: superUrl.toString() });
  await client.connect();
  try {
    for (const role of ROLES) {
      const exists = await client.query('select 1 from pg_roles where rolname = $1', [role.name]);
      const verb = exists.rowCount ? 'ALTER' : 'CREATE';
      const attrs = `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE ${role.bypassRls ? 'BYPASSRLS' : 'NOBYPASSRLS'}`;
      // Rol adı sabit listeden gelir; şifre format(%L) ile kaçışlanır.
      const { rows } = await client.query<{ statement: string }>(
        `select format('${verb} ROLE %I WITH ${attrs} PASSWORD %L', $1::text, $2::text) as statement`,
        [role.name, passwords[role.name]],
      );
      await client.query(rows[0]!.statement);
    }

    for (const db of DATABASES) {
      const exists = await client.query('select 1 from pg_database where datname = $1', [db]);
      if (!exists.rowCount) {
        await client.query(
          `CREATE DATABASE ${db} WITH OWNER servis_owner TEMPLATE template0 ENCODING 'UTF8'
           LOCALE_PROVIDER icu ICU_LOCALE 'tr-TR' LC_COLLATE 'C' LC_CTYPE 'C'`,
        );
      }
      await client.query(`REVOKE ALL ON DATABASE ${db} FROM PUBLIC`);
      await client.query(`GRANT CONNECT ON DATABASE ${db} TO servis_app`);
    }
    await client.query('GRANT CONNECT ON DATABASE servis_takip_test TO servis_test_bypass');
  } finally {
    await client.end();
  }

  const url = (role: string, db: string) =>
    `postgres://${role}:${passwords[role as keyof typeof passwords]}@${host}/${db}`;

  upsertEnvFile('.env', {
    SERVIS_OWNER_PASSWORD: passwords.servis_owner,
    SERVIS_APP_PASSWORD: passwords.servis_app,
    SERVIS_TEST_BYPASS_PASSWORD: passwords.servis_test_bypass,
    DATABASE_URL: url('servis_app', 'servis_takip'),
    DATABASE_ADMIN_URL: url('servis_owner', 'servis_takip'),
    TEST_DATABASE_URL: url('servis_app', 'servis_takip_test'),
    TEST_DATABASE_ADMIN_URL: url('servis_owner', 'servis_takip_test'),
    TEST_DATABASE_BYPASS_URL: url('servis_test_bypass', 'servis_takip_test'),
  });

  console.log('Veritabanı rolleri ve veritabanları hazır. Bağlantı bilgileri .env dosyasına yazıldı.');
}

main().catch((err: unknown) => {
  console.error('db:kur başarısız:', err instanceof Error ? err.message : err);
  process.exit(1);
});

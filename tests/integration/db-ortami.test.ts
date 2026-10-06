import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} yok. Önce "npm run db:kur" çalıştırın.`);
  return value;
}

describe('geliştirme veritabanı ortamı', () => {
  const owner = new Client({ connectionString: env('TEST_DATABASE_ADMIN_URL') });
  const superuser = new Client({ connectionString: env('PG_SUPERUSER_URL') });

  beforeAll(async () => {
    await owner.connect();
    await superuser.connect();
  });
  afterAll(async () => {
    await owner.end();
    await superuser.end();
  });

  it('Türkçe alfabe sırasıyla sıralar', async () => {
    const { rows } = await owner.query<{ x: string }>(
      `select x from unnest(array['Dilek','Şule','Çağlar','Cem','Sena','İsmail','Irmak']) as x order by x`,
    );
    expect(rows.map((r) => r.x)).toEqual([
      'Cem',
      'Çağlar',
      'Dilek',
      'Irmak',
      'İsmail',
      'Sena',
      'Şule',
    ]);
  });

  it('Türkçe büyük/küçük harf dönüşümü yapar', async () => {
    const { rows } = await owner.query(`select lower('IŞIK') as l, upper('istanbul') as u`);
    expect(rows[0]).toEqual({ l: 'ışık', u: 'İSTANBUL' });
  });

  it('roller doğru yetkilerle kurulmuş', async () => {
    const { rows } = await owner.query(
      `select rolname, rolsuper, rolbypassrls from pg_roles
       where rolname in ('servis_owner','servis_app','servis_test_bypass') order by rolname`,
    );
    expect(rows).toEqual([
      { rolname: 'servis_app', rolsuper: false, rolbypassrls: false },
      { rolname: 'servis_owner', rolsuper: false, rolbypassrls: false },
      { rolname: 'servis_test_bypass', rolsuper: false, rolbypassrls: true },
    ]);
  });

  it('RLS atlayan test rolü geliştirme veritabanına bağlanamaz', async () => {
    const { rows } = await superuser.query(
      `select has_database_privilege('servis_test_bypass', 'servis_takip', 'CONNECT') as can`,
    );
    expect(rows[0]).toEqual({ can: false });
  });

  it('yalnızca bu bilgisayardan bağlantı kabul eder', async () => {
    const { rows } = await superuser.query('show listen_addresses');
    expect(rows[0]).toEqual({ listen_addresses: 'localhost' });
  });
});

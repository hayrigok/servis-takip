import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDbs } from '../helpers/db';

/** tenant_id sütunu olmayan, bilerek firmaya bağlı olmayan tablolar. Yeni ekleme gerekçe ister. */
const PLATFORM_TABLES = ['tenants'];

describe('şema denetimi: yeni tablolar ikinci kilitsiz eklenemez', () => {
  const { owner } = useTestDbs();

  it('tenant_id sütunlu her tabloda RLS açık, zorunlu ve politika var', async () => {
    const { rows } = await owner.execute<{
      table_name: string;
      rls: boolean;
      forced: boolean;
      has_policy: boolean;
    }>(sql`
      select c.relname as table_name,
             c.relrowsecurity as rls,
             c.relforcerowsecurity as forced,
             exists (
               select 1 from pg_policy p
               where p.polrelid = c.oid
                 and pg_get_expr(p.polqual, p.polrelid) like '%app.tenant_id%'
                 and pg_get_expr(p.polwithcheck, p.polrelid) like '%app.tenant_id%'
             ) as has_policy
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and exists (select 1 from pg_attribute a
                    where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped)
      order by c.relname`);
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining(['audit_log', 'sessions', 'users']),
    );
    for (const row of rows) {
      expect(row, row.table_name).toMatchObject({ rls: true, forced: true, has_policy: true });
    }
  });

  it('tenant_id sütunu olmayan tablo yalnızca platform listesinde olabilir', async () => {
    const { rows } = await owner.execute<{ table_name: string }>(sql`
      select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and not exists (select 1 from pg_attribute a
                        where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped)
      order by 1`);
    expect(rows.map((r) => r.table_name)).toEqual(PLATFORM_TABLES);
  });

  it('uygulama kullanıcısının izinleri en az ayrıcalık ilkesine uygun', async () => {
    const { rows } = await owner.execute<{ table_name: string; privs: string }>(sql`
      select table_name, string_agg(privilege_type, ',' order by privilege_type) as privs
      from information_schema.role_table_grants
      where grantee = 'servis_app' and table_schema = 'public'
      group by table_name order by table_name`);
    expect(rows).toEqual([
      { table_name: 'audit_log', privs: 'INSERT,SELECT' },
      { table_name: 'sessions', privs: 'DELETE,INSERT,SELECT,UPDATE' },
      { table_name: 'tenants', privs: 'SELECT' },
      { table_name: 'users', privs: 'INSERT,SELECT,UPDATE' },
    ]);
  });
});

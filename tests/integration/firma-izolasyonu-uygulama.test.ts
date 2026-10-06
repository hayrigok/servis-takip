import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { users, type UserRow } from '@/server/db/schema';
import { withTenant, type TenantTx } from '@/server/db/tenant';
import {
  getStaff,
  listStaff,
  resetStaffPassword,
  setStaffActive,
  updateStaff,
} from '@/server/staff/service';
import { createFakeClock } from '../helpers/clock';
import { useTestDbs } from '../helpers/db';
import { actorFor, seedTenant, seedUser, type SeededTenant } from '../helpers/fabrika';

const clock = createFakeClock();

describe('1. kilit: uygulama filtresi RLS olmadan da firmaları ayırır', () => {
  // bypass bağlantısı RLS'yi atlar: buradaki koruma yalnızca servislerdeki tenant_id filtresinden gelir.
  const { bypass, owner } = useTestDbs();
  let a: SeededTenant;
  let b: SeededTenant;
  let aBoss: UserRow;
  let bUser: UserRow;

  beforeAll(async () => {
    a = await seedTenant(owner);
    b = await seedTenant(owner);
    aBoss = await seedUser(owner, a.id, { role: 'owner', fullName: 'A Patron' });
    bUser = await seedUser(owner, b.id, { fullName: 'B Personel' });
  });

  const asA = <T>(fn: (tx: TenantTx) => Promise<T>) => withTenant(bypass, a.id, fn);
  const actor = () => actorFor(aBoss, a.code);

  it('liste yalnızca kendi firmasını döndürür', async () => {
    const list = await asA(async (tx) => listStaff(tx, actor(), { status: 'active' }, clock));
    expect(list.map((s) => s.id)).toEqual([aBoss.id]);
  });

  // Kapanışlar beforeAll'dan sonra çağrıldığı için aBoss ve bUser o anda doludur.
  const attempts: Array<[string, (tx: TenantTx) => Promise<unknown>]> = [
    ['ayrıntı', (tx) => getStaff(tx, actor(), bUser.id, clock)],
    [
      'düzenleme',
      (tx) =>
        updateStaff(
          tx,
          actor(),
          bUser.id,
          { fullName: 'Ele geçirildi', role: 'operator', fieldWork: false },
          clock,
        ),
    ],
    ['pasifleştirme', (tx) => setStaffActive(tx, actor(), bUser.id, false, clock)],
    ['şifre sıfırlama', (tx) => resetStaffPassword(tx, actor(), bUser.id, clock)],
  ];

  it.each(attempts)(
    'başka firmanın kaydında %s "bulunamadı" verir ve kayda dokunmaz',
    async (_name, call) => {
      await expect(asA(call)).rejects.toMatchObject({ kind: 'not_found' });
      const [after] = await bypass.select().from(users).where(eq(users.id, bUser.id));
      expect(after).toMatchObject({
        fullName: 'B Personel',
        isActive: true,
        passwordHash: bUser.passwordHash,
      });
    },
  );
});

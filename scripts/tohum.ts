import { systemClock } from '../src/server/clock';
import { createDb } from '../src/server/db/pool';
import { withTenant } from '../src/server/db/tenant';
import { createTenantWithOwner } from '../src/server/platform/admin';
import { findTenantByCode } from '../src/server/platform/tenants';
import type { Role } from '../src/server/roles';
import { createStaff } from '../src/server/staff/service';
import { loadEnv, requireEnv } from './lib/env';

interface SeedFirm {
  code: string;
  name: string;
  owner: { fullName: string; username: string };
  staff: Array<{ fullName: string; username: string; role: Role; fieldWork: boolean }>;
}

// Uydurma kişiler; Türkçe harfler bilerek kullanıldı (sadeleştirme ve sıralama denensin).
const FIRMS: SeedFirm[] = [
  {
    code: 'deneme-a',
    name: 'Deneme A Servis',
    owner: { fullName: 'Ali Kaya', username: 'patron' },
    staff: [
      { fullName: 'Ayşe Demir', username: 'operator', role: 'operator', fieldWork: false },
      { fullName: 'Mehmet Şahin', username: 'teknisyen', role: 'technician', fieldWork: true },
    ],
  },
  {
    code: 'deneme-b',
    name: 'Deneme B Servis',
    owner: { fullName: 'Zeynep Arslan', username: 'patron' },
    staff: [
      { fullName: 'Can Yıldız', username: 'operator', role: 'operator', fieldWork: false },
      { fullName: 'İsmail Çelik', username: 'İsmail', role: 'technician', fieldWork: true },
    ],
  },
];

async function main(): Promise<void> {
  loadEnv();
  const db = createDb(requireEnv('DATABASE_ADMIN_URL'), { max: 2 });
  try {
    for (const firm of FIRMS) {
      if (await findTenantByCode(db, firm.code)) {
        console.log(`${firm.code}: zaten var, atlandı.`);
        continue;
      }
      const created = await createTenantWithOwner(
        db,
        {
          code: firm.code,
          name: firm.name,
          ownerFullName: firm.owner.fullName,
          ownerUsername: firm.owner.username,
        },
        systemClock,
      );
      console.log(`\nFirma kodu: ${created.code}`);
      console.log(`  Patron     ${created.ownerUsername.padEnd(12)} ${created.tempPassword}`);
      const actor = {
        tenantId: created.tenantId,
        tenantCode: created.code,
        userId: created.ownerUserId,
        username: created.ownerUsername,
        role: 'owner' as const,
        sessionId: null,
      };
      for (const person of firm.staff) {
        const staff = await withTenant(db, created.tenantId, async (tx) =>
          createStaff(tx, actor, person, systemClock),
        );
        const label = person.role === 'operator' ? 'Operatör' : 'Teknisyen';
        console.log(`  ${label.padEnd(10)} ${staff.username.padEnd(12)} ${staff.tempPassword}`);
      }
    }
    console.log(
      '\nGeçici şifreler bir daha gösterilmeyecek. İlk girişte her kişi kendi şifresini belirler.',
    );
  } finally {
    await db.$client.end();
  }
}

main().catch((err: unknown) => {
  console.error('db:tohum başarısız:', err instanceof Error ? err.message : err);
  process.exit(1);
});

import { writeFileSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import { hashPassword } from '../../src/server/auth/password';
import { systemClock } from '../../src/server/clock';
import { createDb } from '../../src/server/db/pool';
import { users } from '../../src/server/db/schema';
import { withTenant } from '../../src/server/db/tenant';
import { createTenantWithOwner } from '../../src/server/platform/admin';
import type { Role } from '../../src/server/roles';
import { createStaff } from '../../src/server/staff/service';
import { resetTestDatabase } from '../helpers/reset-db';
import { ACCOUNTS_FILE, READY_PASSWORD, type E2eAccount, type E2eFirm } from './hesaplar';

type StaffKey = 'operator' | 'teknisyen' | 'ekstra' | 'ilkGiris' | 'ilkGirisBekleyen';

const FIRMS = [
  {
    key: 'a',
    code: 'e2e-a',
    name: 'Akın Servis',
    owner: 'Ali Kaya',
    staff: {
      operator: { fullName: 'Ayşe Demir', role: 'operator' },
      teknisyen: { fullName: 'Mehmet Şahin', role: 'technician' },
      ekstra: { fullName: 'Oğuz Kılıç', role: 'technician' },
      ilkGiris: { fullName: 'Selin Uçar', role: 'operator' },
      ilkGirisBekleyen: { fullName: 'Derya Öz', role: 'operator' },
    },
  },
  {
    key: 'b',
    code: 'e2e-b',
    name: 'Bora Teknik',
    owner: 'Zeynep Arslan',
    staff: {
      operator: { fullName: 'Can Yıldız', role: 'operator' },
      teknisyen: { fullName: 'İsmail Çelik', role: 'technician' },
    },
  },
] as const satisfies ReadonlyArray<{
  key: 'a' | 'b';
  code: string;
  name: string;
  owner: string;
  staff: Partial<Record<StaffKey, { fullName: string; role: Role }>>;
}>;

/** Geçici şifresini koruyan hesaplar (ilk giriş akışı için); diğerleri bilinen şifreye ayarlanır. */
const KEEP_TEMP: ReadonlySet<string> = new Set(['ilkGiris', 'ilkGirisBekleyen']);

export default async function globalSetup(): Promise<void> {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
  if (!adminUrl) throw new Error('TEST_DATABASE_ADMIN_URL yok. Önce "npm run db:kur" çalıştırın.');
  await resetTestDatabase(adminUrl);

  const db = createDb(adminUrl, { max: 2 });
  const readyHash = await hashPassword(READY_PASSWORD);
  const result: Record<string, E2eFirm> = {};
  try {
    for (const firm of FIRMS) {
      const created = await createTenantWithOwner(
        db,
        { code: firm.code, name: firm.name, ownerFullName: firm.owner, ownerUsername: 'patron' },
        systemClock,
      );
      const actor = {
        tenantId: created.tenantId,
        tenantCode: created.code,
        userId: created.ownerUserId,
        username: 'patron',
        role: 'owner' as const,
        sessionId: null,
      };
      const accounts: Record<string, E2eAccount> = {
        patron: {
          id: created.ownerUserId,
          username: 'patron',
          password: READY_PASSWORD,
          fullName: firm.owner,
        },
      };
      for (const [key, person] of Object.entries(firm.staff)) {
        const staff = await withTenant(db, created.tenantId, (tx) =>
          createStaff(
            tx,
            actor,
            { ...person, username: key.toLowerCase(), fieldWork: false },
            systemClock,
          ),
        );
        accounts[key] = {
          id: staff.id,
          username: staff.username,
          password: KEEP_TEMP.has(key) ? staff.tempPassword : READY_PASSWORD,
          fullName: person.fullName,
        };
      }
      await withTenant(db, created.tenantId, async (tx) => {
        for (const [key, account] of Object.entries(accounts)) {
          if (KEEP_TEMP.has(key)) continue;
          await tx
            .update(users)
            .set({ passwordHash: readyHash, mustChangePassword: false })
            .where(and(eq(users.tenantId, created.tenantId), eq(users.id, account.id)));
        }
      });
      result[firm.key] = {
        code: created.code,
        tenantId: created.tenantId,
        name: firm.name,
        accounts,
      };
    }
  } finally {
    await db.$client.end();
  }
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(result, null, 2));
}

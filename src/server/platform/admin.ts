import { eq } from 'drizzle-orm';
import { checkTenantCode, checkUsername, foldIdentifier } from '@/lib/identifier';
import { recordAudit } from '@/server/audit/audit';
import { hashPassword } from '@/server/auth/password';
import { generateTempPassword } from '@/server/auth/temp-password';
import type { Clock } from '@/server/clock';
import { pgErrorField } from '@/server/db/errors';
import type { Db } from '@/server/db/pool';
import { sessions, tenants, users, type TenantStatus } from '@/server/db/schema';
import { enterTenant, withTenant } from '@/server/db/tenant';
import { AppError, conflictError, validationError } from '@/server/errors';

export interface CreateTenantInput {
  code: string;
  name: string;
  ownerFullName: string;
  ownerUsername: string;
}

export interface CreatedTenant {
  tenantId: string;
  code: string;
  ownerUserId: string;
  ownerUsername: string;
  tempPassword: string;
}

/** Sistem sahibi komutu: firmayı ve geçici şifreli ilk patronu tek işlemde açar. servis_owner bağlantısıyla çağrılır. */
export async function createTenantWithOwner(
  db: Db,
  input: CreateTenantInput,
  clock: Clock,
): Promise<CreatedTenant> {
  const fieldErrors: Record<string, string> = {};
  const code = checkTenantCode(input.code);
  if (!code.ok) fieldErrors.code = code.message;
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80) {
    fieldErrors.name = 'Firma adı 1 ile 80 karakter arasında olmalı.';
  }
  const ownerFullName = input.ownerFullName.trim();
  if (ownerFullName.length < 1 || ownerFullName.length > 80) {
    fieldErrors.ownerFullName = 'Patronun adı 1 ile 80 karakter arasında olmalı.';
  }
  const username = checkUsername(input.ownerUsername);
  if (!username.ok) fieldErrors.ownerUsername = username.message;
  if (!code.ok || !username.ok || Object.keys(fieldErrors).length > 0) {
    throw validationError(fieldErrors);
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const now = clock.now();

  try {
    return await db.transaction(async (rawTx) => {
      const [tenant] = await rawTx
        .insert(tenants)
        .values({ code: code.value, name, createdAt: now })
        .returning({ id: tenants.id });
      const tenantId = tenant!.id;
      const tx = await enterTenant(rawTx, tenantId);
      const [owner] = await tx
        .insert(users)
        .values({
          tenantId,
          username: username.value,
          fullName: ownerFullName,
          role: 'owner',
          fieldWork: false,
          passwordHash,
          mustChangePassword: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: users.id });
      await recordAudit(tx, {
        tenantId,
        actorUserId: null,
        action: 'user.created',
        targetUserId: owner!.id,
        details: { role: 'owner', fieldWork: false },
        at: now,
      });
      return {
        tenantId,
        code: code.value,
        ownerUserId: owner!.id,
        ownerUsername: username.value,
        tempPassword,
      };
    });
  } catch (err) {
    if (pgErrorField(err, 'constraint') === 'tenants_code_key') {
      throw conflictError('Bu firma kodu kullanılıyor.', { code: 'Bu firma kodu kullanılıyor.' });
    }
    throw err;
  }
}

/** Sistem sahibi komutu: firmayı dondurur ya da yeniden etkinleştirir. Dondurma bütün oturumları kapatır. */
export async function setTenantStatus(
  db: Db,
  rawCode: string,
  status: TenantStatus,
): Promise<{ tenantId: string; sessionsRemoved: number }> {
  const [tenant] = await db
    .update(tenants)
    .set({ status })
    .where(eq(tenants.code, foldIdentifier(rawCode)))
    .returning({ id: tenants.id });
  if (!tenant) throw new AppError('not_found', 'Bu kodla bir firma bulunamadı.');
  if (status !== 'suspended') return { tenantId: tenant.id, sessionsRemoved: 0 };
  const removed = await withTenant(db, tenant.id, async (tx) =>
    tx.delete(sessions).where(eq(sessions.tenantId, tenant.id)).returning({ id: sessions.id }),
  );
  return { tenantId: tenant.id, sessionsRemoved: removed.length };
}

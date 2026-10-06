import { and, eq } from 'drizzle-orm';
import { checkUsername } from '@/lib/identifier';
import { recordAudit } from '@/server/audit/audit';
import type { Actor } from '@/server/auth/actor';
import { hashPassword } from '@/server/auth/password';
import { deleteUserSessions } from '@/server/auth/session';
import { generateTempPassword } from '@/server/auth/temp-password';
import type { Clock } from '@/server/clock';
import { pgErrorField } from '@/server/db/errors';
import { users } from '@/server/db/schema';
import { isUuid, type TenantTx } from '@/server/db/tenant';
import { conflictError, invalidActionError, notFoundError, validationError } from '@/server/errors';
import { requirePermission } from '@/server/permissions';
import { ROLES, type Role } from '@/server/roles';
import { fieldErrorsFrom, z } from '@/server/validation';

export interface StaffListItem {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  fieldWork: boolean;
  isActive: boolean;
  isLocked: boolean;
  lastLoginAt: Date | null;
}

export interface StaffDetail extends StaffListItem {
  createdAt: Date;
  isSelf: boolean;
}

const fullNameField = z
  .string()
  .trim()
  .min(1, 'Ad ve soyadı yazın.')
  .max(80, 'Ad soyad en fazla 80 karakter olabilir.');
const roleField = z.enum(ROLES, { error: 'Bir rol seçin.' });

const createStaffSchema = z.object({
  fullName: fullNameField,
  username: z.string().max(200),
  role: roleField,
  fieldWork: z.boolean(),
});

const updateStaffSchema = z.object({
  fullName: fullNameField,
  role: roleField,
  fieldWork: z.boolean(),
});

const staffColumns = {
  id: users.id,
  username: users.username,
  fullName: users.fullName,
  role: users.role,
  fieldWork: users.fieldWork,
  isActive: users.isActive,
  lockedUntil: users.lockedUntil,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

type StaffRow = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  fieldWork: boolean;
  isActive: boolean;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
};

function toListItem(row: StaffRow, now: Date): StaffListItem {
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    role: row.role,
    fieldWork: row.fieldWork,
    isActive: row.isActive,
    isLocked: row.lockedUntil !== null && row.lockedUntil > now,
    lastLoginAt: row.lastLoginAt,
  };
}

const byId = (actor: Actor, id: string) =>
  and(eq(users.tenantId, actor.tenantId), eq(users.id, id));

async function loadTarget(tx: TenantTx, actor: Actor, id: string): Promise<StaffRow> {
  if (!isUuid(id)) throw notFoundError();
  const [row] = await tx.select(staffColumns).from(users).where(byId(actor, id)).limit(1);
  if (!row) throw notFoundError();
  return row;
}

/**
 * Etkin patron satırları kimlik sırasıyla kilitlenir: aynı anda iki patronun birbirini pasifleştirip firmayı
 * patronsuz bırakması önlenir; sabit sıra karşılıklı kilitlenmeyi (deadlock) de önler.
 */
async function assertAnotherActiveOwner(
  tx: TenantTx,
  actor: Actor,
  excludingUserId: string,
): Promise<void> {
  const owners = await tx
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.tenantId, actor.tenantId), eq(users.role, 'owner'), eq(users.isActive, true)),
    )
    .orderBy(users.id)
    .for('update');
  if (!owners.some((o) => o.id !== excludingUserId)) {
    throw invalidActionError('Firmada en az bir etkin patron kalmalı.');
  }
}

export async function listStaff(
  tx: TenantTx,
  actor: Actor,
  filter: { status: 'active' | 'inactive' },
  clock: Clock,
): Promise<StaffListItem[]> {
  requirePermission(actor, 'staff.view');
  const rows = await tx
    .select(staffColumns)
    .from(users)
    .where(and(eq(users.tenantId, actor.tenantId), eq(users.isActive, filter.status === 'active')))
    // Veritabanının varsayılan sıralaması ICU tr-TR: Ç, Ş, İ doğru yerde.
    .orderBy(users.fullName, users.id);
  const now = clock.now();
  return rows.map((row) => toListItem(row, now));
}

export async function getStaff(
  tx: TenantTx,
  actor: Actor,
  id: string,
  clock: Clock,
): Promise<StaffDetail> {
  requirePermission(actor, 'staff.view');
  const row = await loadTarget(tx, actor, id);
  return {
    ...toListItem(row, clock.now()),
    createdAt: row.createdAt,
    isSelf: row.id === actor.userId,
  };
}

export async function createStaff(
  tx: TenantTx,
  actor: Actor,
  raw: unknown,
  clock: Clock,
): Promise<{ id: string; username: string; fullName: string; tempPassword: string }> {
  requirePermission(actor, 'staff.manage');
  const parsed = createStaffSchema.safeParse(raw);
  const fieldErrors: Record<string, string> = parsed.success ? {} : fieldErrorsFrom(parsed.error);
  const rawUsername = parsed.success
    ? parsed.data.username
    : (raw as { username?: unknown } | null)?.username;
  const username = checkUsername(typeof rawUsername === 'string' ? rawUsername : '');
  if (!username.ok) fieldErrors.username ??= username.message;
  if (!parsed.success || !username.ok) throw validationError(fieldErrors);

  const { fullName, role } = parsed.data;
  const fieldWork = role === 'technician' ? true : parsed.data.fieldWork;
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const now = clock.now();

  let id: string;
  try {
    const [row] = await tx
      .insert(users)
      .values({
        tenantId: actor.tenantId,
        username: username.value,
        fullName,
        role,
        fieldWork,
        passwordHash,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: users.id });
    id = row!.id;
  } catch (err) {
    if (pgErrorField(err, 'constraint') === 'users_tenant_username_key') {
      // Üstteki uyarı genel, alanın altındaki asıl neden: aynı cümle iki kez görünmesin.
      throw conflictError('İşaretli alanları düzeltin.', {
        username: 'Bu kullanıcı adı firmanızda zaten kullanılıyor.',
      });
    }
    throw err;
  }

  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: 'user.created',
    targetUserId: id,
    details: { role, fieldWork },
    at: now,
  });
  return { id, username: username.value, fullName, tempPassword };
}

export async function updateStaff(
  tx: TenantTx,
  actor: Actor,
  id: string,
  raw: unknown,
  clock: Clock,
): Promise<void> {
  requirePermission(actor, 'staff.manage');
  const parsed = updateStaffSchema.safeParse(raw);
  if (!parsed.success) throw validationError(fieldErrorsFrom(parsed.error));
  const target = await loadTarget(tx, actor, id);
  const { fullName, role } = parsed.data;
  const fieldWork = role === 'technician' ? true : parsed.data.fieldWork;

  if (target.id === actor.userId && role !== target.role) {
    throw validationError({ role: 'Kendi rolünüzü değiştiremezsiniz.' });
  }
  if (target.role === 'owner' && role !== 'owner' && target.isActive) {
    await assertAnotherActiveOwner(tx, actor, target.id);
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (fullName !== target.fullName) changes.fullName = { from: target.fullName, to: fullName };
  if (role !== target.role) changes.role = { from: target.role, to: role };
  if (fieldWork !== target.fieldWork) changes.fieldWork = { from: target.fieldWork, to: fieldWork };
  if (Object.keys(changes).length === 0) return;

  const now = clock.now();
  await tx
    .update(users)
    .set({ fullName, role, fieldWork, updatedAt: now })
    .where(byId(actor, target.id));
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: 'user.updated',
    targetUserId: target.id,
    details: { changes },
    at: now,
  });
}

export async function setStaffActive(
  tx: TenantTx,
  actor: Actor,
  id: string,
  active: boolean,
  clock: Clock,
): Promise<void> {
  requirePermission(actor, 'staff.manage');
  const target = await loadTarget(tx, actor, id);
  if (target.id === actor.userId && !active) {
    throw invalidActionError('Kendi hesabınızı pasifleştiremezsiniz.');
  }
  if (target.isActive === active) return;
  if (!active && target.role === 'owner') await assertAnotherActiveOwner(tx, actor, target.id);

  const now = clock.now();
  await tx.update(users).set({ isActive: active, updatedAt: now }).where(byId(actor, target.id));
  if (!active) await deleteUserSessions(tx, actor.tenantId, target.id);
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: active ? 'user.reactivated' : 'user.deactivated',
    targetUserId: target.id,
    at: now,
  });
}

export async function resetStaffPassword(
  tx: TenantTx,
  actor: Actor,
  id: string,
  clock: Clock,
): Promise<{ tempPassword: string }> {
  requirePermission(actor, 'staff.manage');
  const target = await loadTarget(tx, actor, id);
  if (target.id === actor.userId) {
    throw invalidActionError('Kendi şifrenizi Hesabım sayfasından değiştirebilirsiniz.');
  }
  const tempPassword = generateTempPassword();
  const now = clock.now();
  await tx
    .update(users)
    .set({
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: now,
    })
    .where(byId(actor, target.id));
  await deleteUserSessions(tx, actor.tenantId, target.id);
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: 'user.password_reset',
    targetUserId: target.id,
    at: now,
  });
  return { tempPassword };
}

import { auditLog } from '@/server/db/schema';
import type { TenantTx } from '@/server/db/tenant';

export type AuditAction =
  | 'auth.login'
  | 'auth.locked'
  | 'user.created'
  | 'user.updated'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.password_reset'
  | 'user.password_changed';

export interface AuditEntry {
  tenantId: string;
  /** İşlemi yapan; komut satırından yapılan işlemde null. */
  actorUserId: string | null;
  action: AuditAction;
  targetUserId?: string;
  details?: Record<string, unknown>;
  at: Date;
}

const SECRET_KEY = /pass|hash|token|sifre|parola/i;

/** İşlem geçmişine şifre, özet ya da belirteç yazılmasını engeller (iç içe nesneler dahil). */
export function assertNoSecrets(details: Record<string, unknown>, path = 'details'): void {
  for (const [key, value] of Object.entries(details)) {
    if (SECRET_KEY.test(key)) throw new Error(`audit: forbidden key ${path}.${key}`);
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      assertNoSecrets(value as Record<string, unknown>, `${path}.${key}`);
    }
  }
}

export async function recordAudit(tx: TenantTx, entry: AuditEntry): Promise<void> {
  const details = entry.details ?? {};
  assertNoSecrets(details);
  await tx.insert(auditLog).values({
    tenantId: entry.tenantId,
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetUserId ? 'user' : null,
    targetId: entry.targetUserId ?? null,
    details,
    createdAt: entry.at,
  });
}

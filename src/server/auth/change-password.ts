import { and, eq } from 'drizzle-orm';
import { recordAudit } from '@/server/audit/audit';
import type { Clock } from '@/server/clock';
import { users } from '@/server/db/schema';
import type { TenantTx } from '@/server/db/tenant';
import { forbiddenError, notFoundError, validationError } from '@/server/errors';
import { fieldErrorsFrom, z } from '@/server/validation';
import type { Actor } from './actor';
import { hashPassword, verifyPassword } from './password';
import { checkPasswordPolicy } from './password-policy';
import { deleteUserSessions } from './session';

const changePasswordSchema = z.object({
  currentPassword: z.string().max(512).optional(),
  newPassword: z.string().max(512),
  confirmPassword: z.string().max(512),
});

/**
 * requireCurrent=false yalnızca geçici şifreyle giriş yapmış (mustChangePassword) kullanıcı içindir.
 * Başarıda kullanıcının diğer oturumları kapanır; mevcut oturum (actor.sessionId) korunur.
 */
export async function changePassword(
  tx: TenantTx,
  actor: Actor,
  raw: unknown,
  opts: { requireCurrent: boolean; clock: Clock },
): Promise<void> {
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) throw validationError(fieldErrorsFrom(parsed.error));
  const { currentPassword = '', newPassword, confirmPassword } = parsed.data;
  const byActor = and(eq(users.tenantId, actor.tenantId), eq(users.id, actor.userId));

  const [user] = await tx
    .select({ passwordHash: users.passwordHash, mustChangePassword: users.mustChangePassword })
    .from(users)
    .where(byActor)
    .limit(1);
  if (!user) throw notFoundError();
  if (!opts.requireCurrent && !user.mustChangePassword) throw forbiddenError();

  const fieldErrors: Record<string, string> = {};
  if (opts.requireCurrent) {
    if (!currentPassword) fieldErrors.currentPassword = 'Mevcut şifrenizi yazın.';
    else if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      fieldErrors.currentPassword = 'Mevcut şifre yanlış.';
    }
  }
  if (!newPassword) {
    fieldErrors.newPassword = 'Yeni şifrenizi yazın.';
  } else {
    const policy = checkPasswordPolicy(newPassword, {
      username: actor.username,
      tenantCode: actor.tenantCode,
    });
    if (policy) fieldErrors.newPassword = policy;
    else if (await verifyPassword(user.passwordHash, newPassword)) {
      fieldErrors.newPassword = 'Yeni şifre eskisiyle aynı olamaz.';
    }
  }
  if (newPassword !== confirmPassword) fieldErrors.confirmPassword = 'Şifreler aynı değil.';
  if (Object.keys(fieldErrors).length > 0) throw validationError(fieldErrors);

  const now = opts.clock.now();
  await tx
    .update(users)
    .set({
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: now,
    })
    .where(byActor);
  await deleteUserSessions(tx, actor.tenantId, actor.userId, actor.sessionId ?? undefined);
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: 'user.password_changed',
    targetUserId: actor.userId,
    at: now,
  });
}

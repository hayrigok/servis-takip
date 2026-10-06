'use server';

import type { FormState } from '@/lib/form-state';
import { runAction } from '@/server/action-result';
import { actorFromSession } from '@/server/auth/actor';
import { changePassword } from '@/server/auth/change-password';
import { requireSession } from '@/server/auth/current-user';
import { systemClock } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = actorFromSession(await requireSession());
  const result = await runAction(() =>
    withTenant(getDb(), actor.tenantId, (tx) =>
      changePassword(
        tx,
        actor,
        {
          currentPassword: String(formData.get('currentPassword') ?? ''),
          newPassword: String(formData.get('newPassword') ?? ''),
          confirmPassword: String(formData.get('confirmPassword') ?? ''),
        },
        // Mevcut şifre denemeleri ortak currentPasswordLimiter ile sınırlanır (kullanıcı başına).
        { requireCurrent: true, clock: systemClock },
      ),
    ),
  );
  if (!result.ok) return { message: result.error.message, fieldErrors: result.error.fieldErrors };
  return { success: 'Şifreniz değiştirildi. Diğer cihazlardaki oturumlarınız kapatıldı.' };
}

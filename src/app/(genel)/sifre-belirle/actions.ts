'use server';

import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { runAction } from '@/server/action-result';
import { actorFromSession } from '@/server/auth/actor';
import { changePassword } from '@/server/auth/change-password';
import { requireSession } from '@/server/auth/current-user';
import { systemClock } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';

export async function setInitialPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession({ allowPasswordChange: true });
  // Sunucu eylemi sayfadan bağımsız çağrılabilir: geçici şifresi olmayan biri mevcut şifresini sormadan değiştiremesin.
  if (!session.user.mustChangePassword) redirect('/hesabim');
  const actor = actorFromSession(session);
  const result = await runAction(() =>
    withTenant(getDb(), actor.tenantId, (tx) =>
      changePassword(
        tx,
        actor,
        {
          newPassword: String(formData.get('newPassword') ?? ''),
          confirmPassword: String(formData.get('confirmPassword') ?? ''),
        },
        { requireCurrent: false, clock: systemClock },
      ),
    ),
  );
  if (!result.ok) return { message: result.error.message, fieldErrors: result.error.fieldErrors };
  redirect('/');
}

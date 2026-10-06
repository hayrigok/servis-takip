'use server';

import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/form-state';
import { runAction, type ActionResult } from '@/server/action-result';
import { actorFromSession } from '@/server/auth/actor';
import { requireSession } from '@/server/auth/current-user';
import { systemClock } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';
import {
  createStaff,
  resetStaffPassword,
  setStaffActive,
  updateStaff,
} from '@/server/staff/service';

export interface CreateStaffState extends FormState {
  values?: { fullName: string };
  created?: { fullName: string; username: string; tempPassword: string };
}

async function currentActor() {
  return actorFromSession(await requireSession());
}

function refresh(id?: string): void {
  revalidatePath('/personel');
  if (id) revalidatePath(`/personel/${id}`);
}

export async function createStaffAction(
  _prev: CreateStaffState,
  formData: FormData,
): Promise<CreateStaffState> {
  const actor = await currentActor();
  const input = {
    fullName: String(formData.get('fullName') ?? ''),
    username: String(formData.get('username') ?? ''),
    role: String(formData.get('role') ?? ''),
    fieldWork: formData.get('fieldWork') === 'on',
  };
  const result = await runAction(() =>
    withTenant(getDb(), actor.tenantId, (tx) => createStaff(tx, actor, input, systemClock)),
  );
  if (!result.ok) {
    return {
      message: result.error.message,
      fieldErrors: result.error.fieldErrors,
      values: { fullName: input.fullName },
    };
  }
  refresh();
  const { fullName, username, tempPassword } = result.data;
  return { created: { fullName, username, tempPassword } };
}

export async function updateStaffAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await currentActor();
  const input = {
    fullName: String(formData.get('fullName') ?? ''),
    role: String(formData.get('role') ?? ''),
    fieldWork: formData.get('fieldWork') === 'on',
  };
  const result = await runAction(() =>
    withTenant(getDb(), actor.tenantId, (tx) => updateStaff(tx, actor, id, input, systemClock)),
  );
  if (!result.ok) return { message: result.error.message, fieldErrors: result.error.fieldErrors };
  refresh(id);
  return { success: 'Bilgiler kaydedildi.' };
}

export async function setStaffActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult<null>> {
  const actor = await currentActor();
  const result = await runAction(async () => {
    // İstemciden gelen değer yalnızca gerçek true ise etkinleştirir.
    await withTenant(getDb(), actor.tenantId, (tx) =>
      setStaffActive(tx, actor, id, active === true, systemClock),
    );
    return null;
  });
  if (result.ok) refresh(id);
  return result;
}

export async function resetStaffPasswordAction(
  id: string,
): Promise<ActionResult<{ tempPassword: string }>> {
  const actor = await currentActor();
  const result = await runAction(() =>
    withTenant(getDb(), actor.tenantId, (tx) => resetStaffPassword(tx, actor, id, systemClock)),
  );
  if (result.ok) refresh(id);
  return result;
}

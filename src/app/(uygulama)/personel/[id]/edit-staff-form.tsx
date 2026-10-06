'use client';

import { useActionState, useState } from 'react';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { Notice } from '@/components/ui/notice';
import { SelectField } from '@/components/ui/select-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { TextField } from '@/components/ui/text-field';
import type { FormState } from '@/lib/form-state';
import type { Role } from '@/server/roles';

interface EditStaffFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  roleOptions: ReadonlyArray<{ value: Role; label: string }>;
  fullName: string;
  role: Role;
  fieldWork: boolean;
  isSelf: boolean;
}

export function EditStaffForm({
  action,
  roleOptions,
  fullName,
  role: initialRole,
  fieldWork: initialFieldWork,
  isSelf,
}: EditStaffFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [role, setRole] = useState<Role>(initialRole);
  const [fieldWork, setFieldWork] = useState(initialFieldWork);
  const isTechnician = role === 'technician';

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message && !pending && <Notice tone="error">{state.message}</Notice>}
      {state.success && !pending && <Notice tone="success">{state.success}</Notice>}
      <TextField
        label="Ad soyad"
        name="fullName"
        defaultValue={fullName}
        autoComplete="off"
        required
        error={state.fieldErrors?.fullName}
      />
      <SelectField
        label="Rol"
        name="role"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        options={roleOptions}
        disabled={isSelf}
        hint={isSelf ? 'Kendi rolünüzü değiştiremezsiniz.' : undefined}
        error={state.fieldErrors?.role}
      />
      {/* Devre dışı alan gönderilmez; kendi rolü için mevcut değer gizli alanla gider. */}
      {isSelf && <input type="hidden" name="role" value={role} />}
      <CheckboxField
        label="Sahaya çıkar"
        name="fieldWork"
        checked={isTechnician || fieldWork}
        disabled={isTechnician}
        onChange={(e) => setFieldWork(e.target.checked)}
        hint={
          isTechnician
            ? 'Teknisyenler her zaman sahaya çıkar.'
            : 'İşaretlenirse bu kişiye de iş atanabilir.'
        }
      />
      <SubmitButton pendingLabel="Kaydediliyor…">Kaydet</SubmitButton>
    </form>
  );
}

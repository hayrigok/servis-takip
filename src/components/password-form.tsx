'use client';

import { useActionState } from 'react';
import type { FormState } from '@/lib/form-state';
import { Notice } from './ui/notice';
import { PasswordField } from './ui/password-field';
import { SubmitButton } from './ui/submit-button';

interface PasswordFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  requireCurrent: boolean;
  submitLabel: string;
}

export function PasswordForm({ action, requireCurrent, submitLabel }: PasswordFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message && !pending && <Notice tone="error">{state.message}</Notice>}
      {state.success && !pending && <Notice tone="success">{state.success}</Notice>}
      {requireCurrent && (
        <PasswordField
          label="Mevcut şifre"
          name="currentPassword"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.currentPassword}
        />
      )}
      <PasswordField
        label="Yeni şifre"
        name="newPassword"
        autoComplete="new-password"
        required
        hint="En az 8 karakter. Boşluk ve Türkçe harf kullanabilirsiniz."
        error={state.fieldErrors?.newPassword}
      />
      <PasswordField
        label="Yeni şifre (tekrar)"
        name="confirmPassword"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />
      <ul className="list-disc pl-5 text-sm text-fg-muted">
        <li>Kullanıcı adınızı ve firma kodunu içermesin.</li>
        <li>&quot;12345678&quot; gibi kolay tahmin edilen bir şifre olmasın.</li>
      </ul>
      <SubmitButton pendingLabel="Kaydediliyor…">{submitLabel}</SubmitButton>
    </form>
  );
}

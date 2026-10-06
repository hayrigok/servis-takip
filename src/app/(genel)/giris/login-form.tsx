'use client';

import { useActionState, useState } from 'react';
import { Notice } from '@/components/ui/notice';
import { PasswordField } from '@/components/ui/password-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { TextField } from '@/components/ui/text-field';
import { loginAction, type LoginFormState } from './actions';

const identifierProps = { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } as const;

export function LoginForm({ rememberedTenantCode }: { rememberedTenantCode: string }) {
  const [state, formAction, pending] = useActionState<LoginFormState, FormData>(loginAction, {});
  const [editingTenant, setEditingTenant] = useState(rememberedTenantCode === '');
  const tenantCode = state.values?.tenantCode ?? rememberedTenantCode;
  const showTenantInput = editingTenant || Boolean(state.fieldErrors?.tenantCode);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4" noValidate>
      {/* Gönderim sürerken kaldırılır: aynı hata tekrarlanınca ekran okuyucu yeniden okur. */}
      {state.message && !pending && <Notice tone="error">{state.message}</Notice>}
      {showTenantInput ? (
        <TextField
          label="Firma kodu"
          name="tenantCode"
          defaultValue={tenantCode}
          autoComplete="organization"
          autoFocus={rememberedTenantCode !== ''}
          required
          hint="Firmanızın size verdiği kod, ör. akin-servis"
          error={state.fieldErrors?.tenantCode}
          {...identifierProps}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-3 rounded-control bg-surface-muted px-3 py-1">
          <p className="text-base text-fg">
            Firma: <span className="font-bold">{tenantCode}</span>
          </p>
          <input type="hidden" name="tenantCode" value={tenantCode} />
          <button
            type="button"
            onClick={() => setEditingTenant(true)}
            className="min-h-11 text-base font-bold text-primary underline underline-offset-4"
          >
            Firma kodunu değiştir
          </button>
        </div>
      )}
      <TextField
        label="Kullanıcı adı"
        name="username"
        defaultValue={state.values?.username ?? ''}
        autoComplete="username"
        required
        error={state.fieldErrors?.username}
        {...identifierProps}
      />
      <PasswordField
        label="Şifre"
        name="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Giriş yapılıyor…" fullWidth>
        Giriş yap
      </SubmitButton>
    </form>
  );
}

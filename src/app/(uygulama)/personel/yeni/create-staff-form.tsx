'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { Notice } from '@/components/ui/notice';
import { SelectField } from '@/components/ui/select-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { TextField } from '@/components/ui/text-field';
import { foldIdentifier } from '@/lib/identifier';
import type { Role } from '@/server/roles';
import { createStaffAction, type CreateStaffState } from '../actions';
import { TempPasswordPanel } from '../temp-password-panel';

type RoleOptions = ReadonlyArray<{ value: Role; label: string }>;

/** "Bir kişi daha ekle" formu yeniden kurar (key): önceki geçici şifre ve form durumu bellekte kalmaz. */
export function CreateStaffForm({ roleOptions }: { roleOptions: RoleOptions }) {
  const [round, setRound] = useState(0);
  return (
    <CreateStaffFormBody
      key={round}
      roleOptions={roleOptions}
      focusFirst={round > 0}
      onAddAnother={() => setRound((r) => r + 1)}
    />
  );
}

interface BodyProps {
  roleOptions: RoleOptions;
  focusFirst: boolean;
  onAddAnother: () => void;
}

function CreateStaffFormBody({ roleOptions, focusFirst, onAddAnother }: BodyProps) {
  const [state, formAction, pending] = useActionState<CreateStaffState, FormData>(
    createStaffAction,
    {},
  );
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('technician');
  const [fieldWork, setFieldWork] = useState(false);

  if (state.created) {
    return (
      <TempPasswordPanel title="Hesap açıldı" {...state.created}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/personel" className={buttonClass('primary')}>
            Personel listesine dön
          </Link>
          <Button variant="secondary" onClick={onAddAnother}>
            Bir kişi daha ekle
          </Button>
        </div>
      </TempPasswordPanel>
    );
  }

  const preview = foldIdentifier(username);
  const isTechnician = role === 'technician';

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message && !pending && <Notice tone="error">{state.message}</Notice>}
      <TextField
        label="Ad soyad"
        name="fullName"
        defaultValue={state.values?.fullName ?? ''}
        autoComplete="off"
        autoFocus={focusFirst}
        required
        error={state.fieldErrors?.fullName}
      />
      <TextField
        label="Kullanıcı adı"
        name="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        required
        hint={
          preview
            ? `Kullanıcı adı "${preview}" olarak kaydedilecek.`
            : 'Harf, rakam, nokta, tire ve alt çizgi kullanılabilir.'
        }
        error={state.fieldErrors?.username}
      />
      <SelectField
        label="Rol"
        name="role"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        options={roleOptions}
        error={state.fieldErrors?.role}
      />
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
      <SubmitButton pendingLabel="Hesap açılıyor…">Hesabı aç</SubmitButton>
    </form>
  );
}

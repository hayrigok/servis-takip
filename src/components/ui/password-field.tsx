'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import { describedBy, fieldClass, labelClass } from './field-styles';

interface PasswordFieldProps {
  label: string;
  name: string;
  autoComplete: 'current-password' | 'new-password';
  hint?: string;
  error?: string;
  required?: boolean;
}

export function PasswordField({
  label,
  name,
  autoComplete,
  hint,
  error,
  required,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const hintId = hint ? `${id}-ipucu` : undefined;
  const errorId = error ? `${id}-hata` : undefined;
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hintId, errorId)}
          className={`${fieldClass(Boolean(error))} pr-14`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
          className="absolute inset-y-0 right-0 flex w-14 items-center justify-center rounded-r-control text-fg-muted hover:text-fg"
        >
          <Icon className="size-6" aria-hidden="true" />
        </button>
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

import { useId, type InputHTMLAttributes } from 'react';

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string;
  hint?: string;
}

export function CheckboxField({ label, hint, ...input }: CheckboxFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-ipucu` : undefined;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        {...input}
        aria-describedby={hintId}
        className="mt-3 size-6 shrink-0 accent-primary"
      />
      <div className="flex flex-col">
        <label htmlFor={id} className="flex min-h-12 items-center text-base font-semibold text-fg">
          {label}
        </label>
        {hint && (
          <p id={hintId} className="text-sm text-fg-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

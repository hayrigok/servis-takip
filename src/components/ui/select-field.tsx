import { useId, type SelectHTMLAttributes } from 'react';
import { describedBy, fieldClass, labelClass } from './field-styles';

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  hint?: string;
  error?: string;
}

/** Telefonda en erişilebilir seçim yerel <select>'tir; özel açılır liste kullanılmaz. */
export function SelectField({ label, options, hint, error, ...select }: SelectFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-ipucu` : undefined;
  const errorId = error ? `${id}-hata` : undefined;
  return (
    <div className="@container flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {/* Yerel <select> metni kaydırmaz, okun altında keser: alan yazıya göre darsa (büyük yazı) boşluk ve yazı bir kademe küçülür. */}
      <select
        id={id}
        {...select}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId)}
        className={`${fieldClass(Boolean(error))} @max-3xs:px-2 @max-3xs:text-base`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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

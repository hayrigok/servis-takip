import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'border-2 border-fg bg-surface text-fg hover:bg-surface-muted',
  danger: 'bg-danger text-danger-fg hover:opacity-90',
  ghost: 'text-primary hover:bg-surface-muted',
};

export function buttonClass(variant: ButtonVariant = 'primary', fullWidth = false): string {
  return [
    'type-display inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 py-2 text-lg',
    'transition-colors disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    fullWidth ? 'w-full' : '',
  ].join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({ variant, fullWidth, className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonClass(variant, fullWidth)} ${className ?? ''}`}
      {...props}
    />
  );
}

'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonVariant } from './button';
import { Spinner } from './spinner';

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  fullWidth,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      fullWidth={fullWidth}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

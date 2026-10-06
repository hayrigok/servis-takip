'use client';

import { AlertDialog } from 'radix-ui';
import { Button } from './button';

interface ConfirmDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
}

/** Geri alınması zor işlemler için onay. Telefonda alttan açılır (başparmak erişimi), masaüstünde ortada. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        {/* Örtü her iki temada da koyu: bant rengi iki temada da koyudur. */}
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-band/70" />
        <AlertDialog.Content className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-card bg-surface p-6 shadow-card sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <AlertDialog.Title className="type-display text-xl text-fg">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-base text-fg-muted">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Vazgeç</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={tone} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

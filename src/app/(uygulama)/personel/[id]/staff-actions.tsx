'use client';

import { KeyRound, UserCheck, UserX } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Notice } from '@/components/ui/notice';
import { resetStaffPasswordAction, setStaffActiveAction } from '../actions';
import { TempPasswordPanel } from '../temp-password-panel';

interface StaffActionsProps {
  id: string;
  fullName: string;
  username: string;
  isActive: boolean;
}

export function StaffActions({ id, fullName, username, isActive }: StaffActionsProps) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(
    null,
  );
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const resetPassword = () =>
    startTransition(async () => {
      const result = await resetStaffPasswordAction(id);
      if (result.ok) {
        setFeedback(null);
        setTempPassword(result.data.tempPassword);
      } else setFeedback({ tone: 'error', message: result.error.message });
    });

  const setActive = (active: boolean) =>
    startTransition(async () => {
      const result = await setStaffActiveAction(id, active);
      setFeedback(
        result.ok
          ? {
              tone: 'success',
              message: active ? 'Hesap yeniden etkinleştirildi.' : 'Hesap pasifleştirildi.',
            }
          : { tone: 'error', message: result.error.message },
      );
    });

  return (
    <div className="flex flex-col gap-4">
      {feedback && <Notice tone={feedback.tone}>{feedback.message}</Notice>}
      {tempPassword && (
        <TempPasswordPanel
          title="Şifre sıfırlandı"
          fullName={fullName}
          username={username}
          tempPassword={tempPassword}
        />
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <ConfirmDialog
          trigger={
            <Button variant="secondary" disabled={pending}>
              <KeyRound className="size-5" aria-hidden="true" />
              Şifreyi sıfırla
            </Button>
          }
          title="Şifre sıfırlansın mı?"
          description={`${fullName} için yeni bir geçici şifre oluşturulacak. Kişinin açık oturumları kapanacak.`}
          confirmLabel="Şifreyi sıfırla"
          tone="primary"
          onConfirm={resetPassword}
        />
        {isActive ? (
          <ConfirmDialog
            trigger={
              <Button variant="danger" disabled={pending}>
                <UserX className="size-5" aria-hidden="true" />
                Pasifleştir
              </Button>
            }
            title={`${fullName} pasifleştirilsin mi?`}
            description="Bu kişi artık giriş yapamaz, açık oturumları kapanır. Geçmiş kayıtları silinmez; istediğinizde yeniden etkinleştirebilirsiniz."
            confirmLabel="Pasifleştir"
            onConfirm={() => setActive(false)}
          />
        ) : (
          <ConfirmDialog
            trigger={
              <Button variant="secondary" disabled={pending}>
                <UserCheck className="size-5" aria-hidden="true" />
                Yeniden etkinleştir
              </Button>
            }
            title={`${fullName} yeniden etkinleştirilsin mi?`}
            description="Bu kişi eski şifresiyle yeniden giriş yapabilir. Şifresini bilmiyorsa ardından şifresini sıfırlayın."
            confirmLabel="Etkinleştir"
            tone="primary"
            onConfirm={() => setActive(true)}
          />
        )}
      </div>
    </div>
  );
}

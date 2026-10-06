import { LogOut } from 'lucide-react';
import type { Metadata } from 'next';
import { PasswordForm } from '@/components/password-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireSession } from '@/server/auth/current-user';
import { ROLE_LABELS } from '@/server/roles';
import { logoutAction } from '../actions';
import { changePasswordAction } from './actions';

export const metadata: Metadata = { title: 'Hesabım' };

export default async function AccountPage() {
  const session = await requireSession();
  const rows: Array<[string, string]> = [
    ['Ad soyad', session.user.fullName],
    ['Kullanıcı adı', session.user.username],
    ['Rol', ROLE_LABELS[session.user.role]],
    ['Firma kodu', session.tenant.code],
  ];
  return (
    <>
      <PageHeader title="Hesabım" />
      <div className="mt-6 flex flex-col gap-6">
        <Card>
          <h2 className="type-display text-xl text-fg">Bilgileriniz</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-sm font-bold tracking-wider text-fg-muted uppercase">
                  {label}
                </dt>
                <dd className="text-base break-words text-fg">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <h2 className="mb-4 type-display text-xl text-fg">Şifre değiştir</h2>
          <PasswordForm
            action={changePasswordAction}
            requireCurrent
            submitLabel="Şifreyi değiştir"
          />
        </Card>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary">
            <LogOut className="size-5" aria-hidden="true" />
            Çıkış yap
          </Button>
        </form>
      </div>
    </>
  );
}

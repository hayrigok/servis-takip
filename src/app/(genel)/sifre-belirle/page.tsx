import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PasswordForm } from '@/components/password-form';
import { requireSession } from '@/server/auth/current-user';
import { setInitialPasswordAction } from './actions';

export const metadata: Metadata = { title: 'Şifrenizi belirleyin' };

export default async function SetPasswordPage() {
  const session = await requireSession({ allowPasswordChange: true });
  if (!session.user.mustChangePassword) redirect('/');
  return (
    <>
      <h1 className="type-display text-3xl leading-tight text-fg">Şifrenizi belirleyin</h1>
      <p className="mt-1 mb-6 text-base text-fg-muted">
        Geçici şifreyle giriş yaptınız. Devam etmek için yalnızca sizin bileceğiniz bir şifre
        belirleyin.
      </p>
      <PasswordForm
        action={setInitialPasswordAction}
        requireCurrent={false}
        submitLabel="Şifreyi kaydet"
      />
    </>
  );
}

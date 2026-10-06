import { LogOut } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PasswordForm } from '@/components/password-form';
import { Button } from '@/components/ui/button';
import { requireSession } from '@/server/auth/current-user';
import { logoutAction } from '../../(uygulama)/actions';
import { setInitialPasswordAction } from './actions';

export const metadata: Metadata = { title: 'Şifrenizi belirleyin' };

export default async function SetPasswordPage() {
  const session = await requireSession({ allowPasswordChange: true });
  if (!session.user.mustChangePassword) redirect('/');
  return (
    <>
      {/* Yumuşak tireler (\u00AD): büyük yazıda dar ekranda kelime heceden bölünür; aksi halde görünmez. */}
      <h1 className="type-display text-3xl leading-tight break-words text-fg">
        {'Şif\u00ADre\u00ADni\u00ADzi be\u00ADlir\u00ADle\u00ADyin'}
      </h1>
      <p className="mt-1 mb-6 text-base text-fg-muted">
        Geçici şifreyle giriş yaptınız. Devam etmek için yalnızca sizin bileceğiniz bir şifre
        belirleyin.
      </p>
      <PasswordForm
        action={setInitialPasswordAction}
        requireCurrent={false}
        submitLabel="Şifreyi kaydet"
      />
      {/* Tasarım §7.5: bu durumda çıkış serbest. Ör. hesabı başkasının telefonunda denemiş patron
          şifreyi belirlemeden çıkabilmeli; şifreyi kişinin kendisi belirler. */}
      <form action={logoutAction} className="mt-6 border-t border-border pt-6">
        <Button type="submit" variant="secondary" className="w-full">
          <LogOut className="size-5" aria-hidden="true" />
          Çıkış yap
        </Button>
      </form>
    </>
  );
}

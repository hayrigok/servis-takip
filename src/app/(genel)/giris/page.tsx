import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TENANT_CODE_COOKIE } from '@/server/auth/cookie-config';
import { getSession } from '@/server/auth/current-user';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Giriş' };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.user.mustChangePassword ? '/sifre-belirle' : '/');
  const rememberedTenantCode = (await cookies()).get(TENANT_CODE_COOKIE)?.value ?? '';
  return (
    <>
      <h1 className="type-display text-4xl leading-tight text-fg">Giriş yap</h1>
      <p className="mt-1 text-base text-fg-muted">
        Firma kodunuz, kullanıcı adınız ve şifrenizle girin.
      </p>
      <LoginForm rememberedTenantCode={rememberedTenantCode} />
    </>
  );
}

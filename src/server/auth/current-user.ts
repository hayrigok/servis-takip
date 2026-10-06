import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { systemClock } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { SESSION_COOKIE } from './cookie-config';
import { validateSession, type ValidSession } from './session';

/** Veri erişim katmanı: oturum her istekte bir kez veritabanından doğrulanır. */
export const getSession = cache(async (): Promise<ValidSession | null> => {
  const store = await cookies();
  return validateSession(getDb(), store.get(SESSION_COOKIE)?.value, systemClock);
});

/** Her korumalı sayfa ve sunucu eylemi bunu çağırır (yerleşim düzeni tek başına yeterli değildir). */
export async function requireSession(
  opts: { allowPasswordChange?: boolean } = {},
): Promise<ValidSession> {
  const session = await getSession();
  if (!session) redirect('/giris');
  if (session.user.mustChangePassword && !opts.allowPasswordChange) redirect('/sifre-belirle');
  return session;
}

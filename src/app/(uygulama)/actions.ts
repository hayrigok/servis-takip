'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/server/auth/cookie-config';
import { getSession } from '@/server/auth/current-user';
import { deleteSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    await withTenant(getDb(), session.tenant.id, (tx) =>
      deleteSession(tx, session.tenant.id, session.sessionId),
    );
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/giris');
}

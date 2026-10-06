'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { runAction } from '@/server/action-result';
import {
  SESSION_COOKIE,
  TENANT_CODE_COOKIE,
  sessionCookieOptions,
  tenantCodeCookieOptions,
} from '@/server/auth/cookie-config';
import { login } from '@/server/auth/login';
import { loginIpLimiter } from '@/server/auth/rate-limit';
import { encodeSessionCookie } from '@/server/auth/session';
import { systemClock } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { clientIp } from '@/server/request-ip';

export interface LoginFormState {
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: { tenantCode: string; username: string };
}

export async function loginAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const values = {
    tenantCode: String(formData.get('tenantCode') ?? ''),
    username: String(formData.get('username') ?? ''),
  };
  const password = String(formData.get('password') ?? '');
  const ip = await clientIp();
  const outcome = await runAction(() =>
    login(getDb(), { ...values, password }, { ip, clock: systemClock, limiter: loginIpLimiter }),
  );
  if (!outcome.ok) return { message: outcome.error.message, values };
  const result = outcome.data;
  if (!result.ok) return { message: result.message, fieldErrors: result.fieldErrors, values };

  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    encodeSessionCookie(result.tenantId, result.token),
    sessionCookieOptions(result.expiresAt),
  );
  store.set(TENANT_CODE_COOKIE, result.tenantCode, tenantCodeCookieOptions());
  redirect(result.mustChangePassword ? '/sifre-belirle' : '/');
}

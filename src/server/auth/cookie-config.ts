export const SESSION_COOKIE = 'oturum';
export const TENANT_CODE_COOKIE = 'firma_kodu';
export const SESSION_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;
const TENANT_CODE_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;

const secure = process.env.NODE_ENV === 'production';

export function sessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    ...(expiresAt ? { expires: expiresAt } : { maxAge: SESSION_COOKIE_MAX_AGE_S }),
  };
}

export function tenantCodeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: TENANT_CODE_COOKIE_MAX_AGE_S,
  };
}

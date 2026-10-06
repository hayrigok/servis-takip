const PUBLIC_PATHS = new Set(['/giris']);

export type ProxyDecision =
  { action: 'redirect'; to: '/giris' } | { action: 'next'; refreshSessionCookie: boolean };

/**
 * İyimser karar: yalnızca çerezin varlığına bakar, veritabanına gitmez. Asıl doğrulama sayfada (requireSession).
 * Giriş sayfası hiçbir zaman yönlendirmez: bayat çerezle yönlendirme döngüsü oluşmaz.
 */
export function decideProxy(pathname: string, hasSessionCookie: boolean): ProxyDecision {
  if (PUBLIC_PATHS.has(pathname)) return { action: 'next', refreshSessionCookie: false };
  if (!hasSessionCookie) return { action: 'redirect', to: '/giris' };
  return { action: 'next', refreshSessionCookie: true };
}

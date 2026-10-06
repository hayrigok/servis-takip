import { NextResponse, type NextRequest } from 'next/server';
import { decideProxy } from '@/lib/proxy-decision';
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/auth/cookie-config';

export function proxy(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const decision = decideProxy(request.nextUrl.pathname, Boolean(session));
  if (decision.action === 'redirect') {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }
  const response = NextResponse.next();
  // Sunucu bileşenleri çerez yazamaz; kayan oturum süresinin çerez tarafı burada yenilenir (veritabanına gidilmez).
  if (decision.refreshSessionCookie && session) {
    response.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webmanifest|txt)$).*)',
  ],
};

import { describe, expect, it } from 'vitest';
import {
  decodeSessionCookie,
  encodeSessionCookie,
  generateSessionToken,
  hashSessionToken,
} from '@/server/auth/session';

const tenantId = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

describe('oturum çerezi', () => {
  it('firma kimliği ve belirteç gidip gelir', () => {
    const token = generateSessionToken();
    expect(decodeSessionCookie(encodeSessionCookie(tenantId, token))).toEqual({ tenantId, token });
  });

  it.each([
    undefined,
    '',
    'abc',
    `${tenantId}`,
    `${tenantId}.kisa`,
    `degil-uuid.${'a'.repeat(43)}`,
    `.${'a'.repeat(43)}`,
    `${tenantId}.${'a'.repeat(44)}`,
  ])('bozuk değeri reddeder: %s', (value) => expect(decodeSessionCookie(value)).toBeNull());

  it('belirteç 43 karakter base64url, özeti 64 karakter hex', () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});

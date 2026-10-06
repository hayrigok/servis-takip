import { describe, expect, it } from 'vitest';
import { dummyVerify, hashPassword, verifyPassword } from '@/server/auth/password';

describe('şifre özeti', () => {
  it('argon2id ve OWASP parametreleriyle özetler', async () => {
    const hash = await hashPassword('Doğru Şifre 9');
    expect(hash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
  });
  it('doğru şifreyi kabul eder, yanlışı reddeder', async () => {
    const hash = await hashPassword('Doğru Şifre 9');
    expect(await verifyPassword(hash, 'Doğru Şifre 9')).toBe(true);
    expect(await verifyPassword(hash, 'doğru şifre 9')).toBe(false);
  });
  it('bozuk özet için hata fırlatmaz, false döner', async () => {
    expect(await verifyPassword('bozuk', 'x')).toBe(false);
  });
  it('sahte doğrulama hata fırlatmaz', async () => {
    await expect(dummyVerify('herhangi')).resolves.toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { checkPasswordPolicy } from '@/server/auth/password-policy';

const ctx = { username: 'ahmet', tenantCode: 'akin-servis' };

describe('şifre kuralları', () => {
  it('uygun şifreyi kabul eder', () => {
    expect(checkPasswordPolicy('Kombi Tamir 42', ctx)).toBeNull();
  });
  it('8 karakterden kısa', () => {
    expect(checkPasswordPolicy('kisa12', ctx)).toBe('Şifre en az 8 karakter olmalı.');
  });
  it('128 karakterden uzun', () => {
    expect(checkPasswordPolicy('a'.repeat(129), ctx)).toBe('Şifre en fazla 128 karakter olabilir.');
  });
  it('karakteri harf sayısıyla sayar (emoji iki birim sayılmaz)', () => {
    expect(checkPasswordPolicy('🔧🔧🔧🔧🔧🔧🔧x', ctx)).toBeNull();
  });
  it('kullanıcı adını içeremez (Türkçe harften bağımsız)', () => {
    expect(checkPasswordPolicy('AHMET2026!', ctx)).toBe('Şifre kullanıcı adınızı içeremez.');
  });
  it('firma kodunu içeremez', () => {
    expect(checkPasswordPolicy('Akın-Servis1', ctx)).toBe('Şifre firma kodunu içeremez.');
  });
  it('3 harfli kullanıcı adında yalnızca birebir aynılığı reddeder', () => {
    expect(checkPasswordPolicy('kalibrasyon9', { username: 'ali', tenantCode: 'xyz' })).toBeNull();
  });
  it.each(['12345678', 'qwerty123', 'Sifre123', 'galatasaray', 'PAROLA123'])(
    'yaygın şifre: %s',
    (pw) => {
      expect(checkPasswordPolicy(pw, ctx)).toBe(
        'Bu şifre çok yaygın ve kolay tahmin edilir. Başka bir şifre seçin.',
      );
    },
  );
});

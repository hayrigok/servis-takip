import { describe, expect, it } from 'vitest';
import { checkTenantCode, checkUsername, foldIdentifier } from '@/lib/identifier';

describe('foldIdentifier', () => {
  it.each(['İsmail', 'Ismail', 'ısmail', 'ISMAIL', '  ismail  ', 'İsmail', 'i̇smail'])(
    '"%s" → ismail',
    (input) => expect(foldIdentifier(input)).toBe('ismail'),
  );

  it('Türkçe harfleri ASCII karşılığına çevirir', () => {
    expect(foldIdentifier('Şükrü.Çağlar-ÖĞÜ')).toBe('sukru.caglar-ogu');
  });
});

describe('checkUsername', () => {
  it('geçerli adı sadeleştirerek döndürür', () => {
    expect(checkUsername('Ahmet.Yılmaz')).toEqual({ ok: true, value: 'ahmet.yilmaz' });
  });
  it('boşluğu reddeder', () => {
    expect(checkUsername('Ali Veli')).toEqual({
      ok: false,
      message:
        'Kullanıcı adında yalnızca harf, rakam, nokta (.), tire (-) ve alt çizgi (_) kullanılabilir.',
    });
  });
  it.each(['ab', 'a'.repeat(31)])('uzunluk sınırı: %s', (input) => {
    expect(checkUsername(input)).toEqual({
      ok: false,
      message: 'Kullanıcı adı 3 ile 30 karakter arasında olmalı.',
    });
  });
});

describe('checkTenantCode', () => {
  it('geçerli kodu sadeleştirir', () => {
    expect(checkTenantCode('Akın-Servis')).toEqual({ ok: true, value: 'akin-servis' });
  });
  it.each(['-abc', 'abc-', 'akın servis', 'a.b.c'])('geçersiz: %s', (input) => {
    expect(checkTenantCode(input)).toEqual({
      ok: false,
      message:
        'Firma kodunda yalnızca harf, rakam ve tire (-) kullanılabilir; kod tireyle başlayamaz ve bitemez.',
    });
  });
});

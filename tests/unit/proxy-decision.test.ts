import { describe, expect, it } from 'vitest';
import { decideProxy } from '@/lib/proxy-decision';

describe('proxy kararı', () => {
  it('çerezsiz korumalı sayfayı girişe yönlendirir', () => {
    expect(decideProxy('/personel', false)).toEqual({ action: 'redirect', to: '/giris' });
    expect(decideProxy('/', false)).toEqual({ action: 'redirect', to: '/giris' });
  });
  it('çerezli korumalı sayfada çerezi yeniler', () => {
    expect(decideProxy('/personel', true)).toEqual({ action: 'next', refreshSessionCookie: true });
  });
  it('giriş sayfasını çerez olsa da olmasa da yönlendirmez (bayat çerezle döngü olmaz)', () => {
    expect(decideProxy('/giris', false)).toEqual({ action: 'next', refreshSessionCookie: false });
    expect(decideProxy('/giris', true)).toEqual({ action: 'next', refreshSessionCookie: false });
  });
});

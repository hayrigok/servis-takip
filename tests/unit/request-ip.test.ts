import { describe, expect, it } from 'vitest';
import { ipFromHeaders } from '@/server/request-ip';

const withXff = (value: string) => new Headers({ 'x-forwarded-for': value });

describe('ipFromHeaders', () => {
  it('ters vekilin eklediği en sağdaki adresi alır; istemcinin yazdığı sol taraf sayılmaz', () => {
    // nginx $proxy_add_x_forwarded_for: "<istemcinin gönderdiği>, <gerçek adres>"
    expect(ipFromHeaders(withXff('1.2.3.4, 203.0.113.7'))).toBe('203.0.113.7');
  });

  it('istemci sol tarafı her istekte değiştirse de anahtar aynı kalır (sınır atlatılamaz)', () => {
    const keys = ['10.0.0.1', '10.0.0.2', '10.0.0.3'].map((spoof) =>
      ipFromHeaders(withXff(`${spoof}, 203.0.113.7`)),
    );
    expect(new Set(keys)).toEqual(new Set(['203.0.113.7']));
  });

  it('tek değerli başlıkta o değeri alır (Next.js vekilsiz bağlantıda soket adresini yazar)', () => {
    expect(ipFromHeaders(withXff('::1'))).toBe('::1');
  });

  it('boş parçaları ve boşlukları yok sayar', () => {
    expect(ipFromHeaders(withXff(' 1.2.3.4 ,, 203.0.113.7 , '))).toBe('203.0.113.7');
  });

  it("x-real-ip'e güvenmez: istemci yazabilir", () => {
    expect(ipFromHeaders(new Headers({ 'x-real-ip': '9.9.9.9' }))).toBe('bilinmiyor');
  });

  it('başlık yoksa ortak "bilinmiyor" anahtarı döner', () => {
    expect(ipFromHeaders(new Headers())).toBe('bilinmiyor');
  });
});

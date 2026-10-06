import 'server-only';
import { headers } from 'next/headers';

/**
 * x-forwarded-for'un en sağındaki adres: istemcinin göremediği son halkanın (önümüzdeki ters vekilin) yazdığı değer.
 * Soldaki parçaları istemci serbestçe yazar; onları kullanmak deneme sınırını atlatır.
 * Vekil yokken başlığı Next.js soket adresiyle doldurur (yalnızca istemci göndermediyse).
 * Varsayım: üretimde önümüzde tam bir ters vekil var (HTTPS için zorunlu). Araya CDN girerse burası değişir (CLAUDE.md teknik borç).
 */
export function ipFromHeaders(h: Headers): string {
  const hops = (h.get('x-forwarded-for') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return hops.at(-1) ?? 'bilinmiyor';
}

/** Yalnızca bellekteki giriş deneme sınırı için; hiçbir yere yazılmaz. */
export async function clientIp(): Promise<string> {
  return ipFromHeaders(await headers());
}

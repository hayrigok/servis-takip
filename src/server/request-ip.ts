import 'server-only';
import { headers } from 'next/headers';

/**
 * Yalnızca bellekteki giriş deneme sınırı için; hiçbir yere yazılmaz.
 * Dikkat: x-forwarded-for yalnızca güvenilen ters vekil arkasında güvenilirdir (sunucu kararıyla ayarlanacak, CLAUDE.md teknik borç).
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'bilinmiyor';
}

import { describe, expect, it } from 'vitest';
import { formatDateTime } from '@/lib/format';

describe('tarih-saat gösterimi (Europe/Istanbul)', () => {
  it('UTC zamanı İstanbul saatiyle, Türkçe ay adıyla gösterir', () => {
    expect(formatDateTime(new Date('2026-10-06T09:05:00Z'))).toBe('6 Ekim 2026 12:05');
  });
  it('gün ve yıl dönümünü İstanbul saatine göre hesaplar', () => {
    expect(formatDateTime(new Date('2026-12-31T22:30:00Z'))).toBe('1 Ocak 2027 01:30');
  });
});

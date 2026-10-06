import { describe, expect, it } from 'vitest';
import { fieldErrorsFrom, z } from '@/server/validation';

describe('Zod Türkçe', () => {
  it('varsayılan mesajlar Türkçe, alan başına ilk hata alınır', () => {
    const schema = z.object({ ad: z.string(), yas: z.number() });
    const parsed = schema.safeParse({ ad: 5 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const errors = fieldErrorsFrom(parsed.error);
    expect(Object.keys(errors).sort()).toEqual(['ad', 'yas']);
    expect(errors.ad).not.toMatch(/expected|invalid/i);
  });
});

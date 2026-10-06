import { describe, expect, it } from 'vitest';
import { TEMP_PASSWORD_PATTERN, generateTempPassword } from '@/server/auth/temp-password';

describe('geçici şifre', () => {
  it('abcd-efgh-jkmn biçiminde, karışan karakterler olmadan üretilir', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword();
      expect(pw).toMatch(TEMP_PASSWORD_PATTERN);
      expect(pw).not.toMatch(/[01ilo]/);
    }
  });
  it('her seferinde farklıdır', () => {
    const set = new Set(Array.from({ length: 200 }, () => generateTempPassword()));
    expect(set.size).toBe(200);
  });
});

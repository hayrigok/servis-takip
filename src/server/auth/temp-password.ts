import { randomInt } from 'node:crypto';

// 0, o, 1, l ve i yok: patron şifreyi personele söylerken ya da yazarken karışmasın.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export const TEMP_PASSWORD_PATTERN = /^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/;

export function generateTempPassword(): string {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)]
    .map((g) => g.join(''))
    .join('-');
}

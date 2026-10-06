import { foldIdentifier } from '@/lib/identifier';
import { COMMON_PASSWORDS } from './common-passwords';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

function containsIdentifier(foldedPassword: string, identifier: string): boolean {
  if (!identifier) return false;
  // Çok kısa adlarda (ör. "ali") "içerir" kuralı masum şifreleri de reddeder; yalnızca aynılık aranır.
  return identifier.length >= 4
    ? foldedPassword.includes(identifier)
    : foldedPassword === identifier;
}

/** Şifre kurallara uyuyorsa null, uymuyorsa kullanıcıya gösterilecek Türkçe mesaj. Şifre kırpılmaz. */
export function checkPasswordPolicy(
  password: string,
  ctx: { username: string; tenantCode: string },
): string | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) return 'Şifre en az 8 karakter olmalı.';
  if (length > PASSWORD_MAX_LENGTH) return 'Şifre en fazla 128 karakter olabilir.';
  const folded = foldIdentifier(password);
  if (containsIdentifier(folded, ctx.username)) return 'Şifre kullanıcı adınızı içeremez.';
  if (containsIdentifier(folded, ctx.tenantCode)) return 'Şifre firma kodunu içeremez.';
  if (COMMON_PASSWORDS.has(folded)) {
    return 'Bu şifre çok yaygın ve kolay tahmin edilir. Başka bir şifre seçin.';
  }
  return null;
}

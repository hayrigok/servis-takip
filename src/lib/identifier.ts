const TURKISH_FOLD: Readonly<Record<string, string>> = {
  İ: 'i',
  I: 'i',
  ı: 'i',
  Ş: 's',
  ş: 's',
  Ğ: 'g',
  ğ: 'g',
  Ü: 'u',
  ü: 'u',
  Ö: 'o',
  ö: 'o',
  Ç: 'c',
  ç: 'c',
};

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
export const TENANT_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export type IdentifierCheck = { ok: true; value: string } | { ok: false; message: string };

/**
 * Firma kodunu ve kullanıcı adını tek biçime getirir: "İsmail", "Ismail", "ısmail" → "ismail".
 * Telefon klavyesinin büyük harfle başlatması ya da Türkçe/İngilizce klavye farkı girişi bozmasın diye.
 */
export function foldIdentifier(input: string): string {
  return input
    .normalize('NFC')
    .trim()
    .replace(/[İIıŞşĞğÜüÖöÇç]/g, (ch) => TURKISH_FOLD[ch] ?? ch)
    .toLowerCase()
    .replace(/̇/g, '');
}

export function checkUsername(raw: string): IdentifierCheck {
  const value = foldIdentifier(raw);
  if (value.length < 3 || value.length > 30) {
    return { ok: false, message: 'Kullanıcı adı 3 ile 30 karakter arasında olmalı.' };
  }
  if (!USERNAME_PATTERN.test(value)) {
    return {
      ok: false,
      message:
        'Kullanıcı adında yalnızca harf, rakam, nokta (.), tire (-) ve alt çizgi (_) kullanılabilir.',
    };
  }
  return { ok: true, value };
}

export function checkTenantCode(raw: string): IdentifierCheck {
  const value = foldIdentifier(raw);
  if (value.length < 3 || value.length > 30) {
    return { ok: false, message: 'Firma kodu 3 ile 30 karakter arasında olmalı.' };
  }
  if (!TENANT_CODE_PATTERN.test(value)) {
    return {
      ok: false,
      message:
        'Firma kodunda yalnızca harf, rakam ve tire (-) kullanılabilir; kod tireyle başlayamaz ve bitemez.',
    };
  }
  return { ok: true, value };
}

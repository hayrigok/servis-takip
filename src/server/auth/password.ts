import { hash, verify } from '@node-rs/argon2';

// OWASP Password Storage Cheat Sheet: argon2id (paketin varsayılanı), m=19 MiB, t=2, p=1.
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Firma ya da kullanıcı yokken de yanıt süresi aynı kalsın diye yapılan sahte doğrulama. */
export async function dummyVerify(password: string): Promise<void> {
  dummyHash ??= hashPassword('servis-takip-sahte-dogrulama');
  await verifyPassword(await dummyHash, password);
}

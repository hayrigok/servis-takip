export interface FailureLimiter {
  isBlocked(key: string, now: Date): boolean;
  recordFailure(key: string, now: Date): void;
  /** `recordFailure(key, at)` ile sayılmış bir denemeyi geri alır; öyle bir kayıt yoksa bir şey yapmaz. */
  forgive(key: string, at: Date): void;
}

/**
 * Bellekte tutulan kayan pencere sınırı. Anahtar (IP ya da kullanıcı kimliği) hiçbir yere yazılmaz.
 * Tek sunucu varsayımı: birden çok sunucuya geçilirse paylaşılan depoya taşınmalı (CLAUDE.md teknik borç).
 */
export function createFailureLimiter(opts: {
  maxFailures: number;
  windowMs: number;
  maxKeys?: number;
}): FailureLimiter {
  const failures = new Map<string, number[]>();
  const maxKeys = opts.maxKeys ?? 10_000;

  function recent(key: string, now: Date): number[] {
    const list = (failures.get(key) ?? []).filter((t) => now.getTime() - t < opts.windowMs);
    if (list.length > 0) failures.set(key, list);
    else failures.delete(key);
    return list;
  }

  return {
    isBlocked: (key, now) => recent(key, now).length >= opts.maxFailures,
    recordFailure(key, now) {
      const list = recent(key, now);
      list.push(now.getTime());
      failures.delete(key);
      failures.set(key, list);
      if (failures.size > maxKeys) {
        const oldest = failures.keys().next().value;
        if (oldest !== undefined) failures.delete(oldest);
      }
    },
    forgive(key, at) {
      const list = failures.get(key);
      const index = list?.lastIndexOf(at.getTime()) ?? -1;
      if (!list || index === -1) return;
      list.splice(index, 1);
      if (list.length === 0) failures.delete(key);
    },
  };
}

export const loginIpLimiter = createFailureLimiter({ maxFailures: 20, windowMs: 15 * 60_000 });

/** Hesabım'da mevcut şifre denemeleri; anahtar "firma kimliği:kullanıcı kimliği". */
export const currentPasswordLimiter = createFailureLimiter({
  maxFailures: 5,
  windowMs: 15 * 60_000,
});

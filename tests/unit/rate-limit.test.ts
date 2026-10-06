import { describe, expect, it } from 'vitest';
import { createFailureLimiter } from '@/server/auth/rate-limit';

const t0 = new Date('2026-10-06T09:00:00Z');
const at = (ms: number) => new Date(t0.getTime() + ms);

describe('başarısız deneme sınırı', () => {
  it('sınıra ulaşınca engeller, başka anahtarı etkilemez', () => {
    const limiter = createFailureLimiter({ maxFailures: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) limiter.recordFailure('1.1.1.1', t0);
    expect(limiter.isBlocked('1.1.1.1', t0)).toBe(true);
    expect(limiter.isBlocked('2.2.2.2', t0)).toBe(false);
  });

  it('pencere geçince yeniden izin verir', () => {
    const limiter = createFailureLimiter({ maxFailures: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) limiter.recordFailure('1.1.1.1', t0);
    expect(limiter.isBlocked('1.1.1.1', at(60_001))).toBe(false);
  });

  it('bellekte sınırsız büyümez (en eski anahtar atılır)', () => {
    const limiter = createFailureLimiter({ maxFailures: 1, windowMs: 60_000, maxKeys: 2 });
    limiter.recordFailure('a', t0);
    limiter.recordFailure('b', t0);
    limiter.recordFailure('c', t0);
    expect(limiter.isBlocked('a', t0)).toBe(false);
    expect(limiter.isBlocked('c', t0)).toBe(true);
  });

  it('geri alınan deneme sayılmaz, kaydı olmayan geri alma etkisizdir', () => {
    const limiter = createFailureLimiter({ maxFailures: 2, windowMs: 60_000 });
    limiter.recordFailure('1.1.1.1', t0);
    limiter.recordFailure('1.1.1.1', at(1));
    limiter.forgive('1.1.1.1', at(1));
    expect(limiter.isBlocked('1.1.1.1', at(2))).toBe(false);
    limiter.forgive('1.1.1.1', at(5));
    limiter.forgive('9.9.9.9', at(5));
    limiter.recordFailure('1.1.1.1', at(3));
    expect(limiter.isBlocked('1.1.1.1', at(4))).toBe(true);
  });
});

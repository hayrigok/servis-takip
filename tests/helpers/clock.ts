import type { Clock } from '@/server/clock';

export interface FakeClock extends Clock {
  advance(ms: number): void;
  set(date: Date): void;
}

export function createFakeClock(start = new Date('2026-10-06T09:00:00.000Z')): FakeClock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance(ms) {
      current += ms;
    },
    set(date) {
      current = date.getTime();
    },
  };
}

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

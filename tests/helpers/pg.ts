import { expect } from 'vitest';
import { pgErrorField } from '@/server/db/errors';

export async function expectPgError(promise: Promise<unknown>, code: string): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught, `PostgreSQL ${code} hatası bekleniyordu`).toBeDefined();
  expect(pgErrorField(caught, 'code')).toBe(code);
}

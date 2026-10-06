export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';
export const PG_CHECK_VIOLATION = '23514';
export const PG_INSUFFICIENT_PRIVILEGE = '42501';

/** Drizzle, pg hatasını DrizzleQueryError içine sarar; asıl alan "cause" zincirindedir. */
export function pgErrorField(err: unknown, field: 'code' | 'constraint'): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current !== null && typeof current === 'object'; depth++) {
    const value = (current as Record<string, unknown>)[field];
    if (typeof value === 'string') return value;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

import { AppError } from './errors';
import { logger } from './logger';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string; fieldErrors?: Record<string, string> } };

/** Sunucu eyleminin gövdesini sarar. redirect() bu fonksiyonun DIŞINDA çağrılmalı. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        ok: false,
        error: err.fieldErrors
          ? { message: err.userMessage, fieldErrors: { ...err.fieldErrors } }
          : { message: err.userMessage },
      };
    }
    const code = logger.error('action_failed', err);
    return {
      ok: false,
      error: { message: `Bir şeyler ters gitti. Tekrar dener misiniz? (Hata kodu: ${code})` },
    };
  }
}

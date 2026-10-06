export type AppErrorKind = 'validation' | 'forbidden' | 'not_found' | 'conflict';

/** Kullanıcıya gösterilebilir, beklenen hata. Mesaj Türkçedir. Diğer her hata "beklenmeyen" sayılır. */
export class AppError extends Error {
  constructor(
    readonly kind: AppErrorKind,
    readonly userMessage: string,
    readonly fieldErrors?: Readonly<Record<string, string>>,
  ) {
    super(userMessage);
    this.name = 'AppError';
  }
}

export const validationError = (
  fieldErrors: Readonly<Record<string, string>>,
  message = 'İşaretli alanları düzeltin.',
) => new AppError('validation', message, fieldErrors);

export const invalidActionError = (message: string) => new AppError('validation', message);
export const forbiddenError = () => new AppError('forbidden', 'Bu işlem için yetkiniz yok.');
export const notFoundError = () => new AppError('not_found', 'Kayıt bulunamadı.');
export const conflictError = (message: string, fieldErrors?: Readonly<Record<string, string>>) =>
  new AppError('conflict', message, fieldErrors);

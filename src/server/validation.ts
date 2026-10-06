import { z } from 'zod';

// Kendi mesajımızı vermediğimiz durumlarda (beklenmeyen tür vb.) bile Türkçe mesaj çıksın.
z.config(z.locales.tr());

export { z };

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    result[key] ??= issue.message;
  }
  return result;
}

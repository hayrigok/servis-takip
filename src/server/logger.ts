import { randomBytes } from 'node:crypto';

type Fields = Record<string, string | number | boolean>;

function errorShape(err: unknown): Fields {
  if (!(err instanceof Error)) return { errorName: typeof err };
  const shape: Fields = { errorName: err.name };
  const pgCode =
    (err as { code?: unknown }).code ?? (err.cause as { code?: unknown } | undefined)?.code;
  if (typeof pgCode === 'string') shape.pgCode = pgCode;
  // Yığının başı hata mesajıdır (birden çok satır olabilir) ve kişisel veri içerebilir;
  // yalnızca "at ..." çağrı satırları yazılır.
  const frames = err.stack?.split('\n').filter((line) => /^\s+at /.test(line));
  if (frames?.length) shape.stack = frames.join('\n');
  return shape;
}

/**
 * Kişisel veri yazmayan kayıt. Ad, telefon, adres, şifre, belirteç, IP ve girdi değeri ASLA alana konmaz;
 * yalnızca olay adı, kimlikler ve kodlar.
 */
export const logger = {
  error(event: string, err: unknown): string {
    const code = randomBytes(4).toString('hex').toUpperCase();
    console.error(JSON.stringify({ level: 'error', event, code, ...errorShape(err) }));
    return code;
  },
  info(event: string, fields: Fields = {}): void {
    console.info(JSON.stringify({ level: 'info', event, ...fields }));
  },
};

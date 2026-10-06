import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve('src');
const TOKEN_FILE = path.join('app', 'globals.css');
const COLOR_LITERAL =
  /(?<![\w-])#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/i;

describe('renkler yalnızca token dosyasında', () => {
  it('src altında token dosyası dışında renk kodu yok', () => {
    const offenders = readdirSync(ROOT, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.(tsx?|css)$/.test(file) && file !== TOKEN_FILE)
      .flatMap((file) =>
        readFileSync(path.join(ROOT, file), 'utf8')
          .split('\n')
          .map((line, i) => ({ file, line: i + 1, text: line.trim() }))
          .filter(({ text }) => COLOR_LITERAL.test(text)),
      )
      .map(({ file, line, text }) => `${file}:${line}: ${text}`);
    expect(offenders).toEqual([]);
  });
});

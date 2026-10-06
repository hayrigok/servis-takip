import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export function loadEnv(file = '.env'): void {
  if (existsSync(file)) process.loadEnvFile(file);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} .env dosyasında yok. Önce "npm run db:kur" çalıştırın.`);
  }
  return value;
}

/** .env dosyasındaki anahtarları günceller ya da ekler; diğer satırlara dokunmaz. */
export function upsertEnvFile(file: string, values: Readonly<Record<string, string>>): void {
  const lines = existsSync(file)
    ? readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((line, i, all) => i < all.length - 1 || line !== '')
    : [];
  const written = new Set<string>();
  const output = lines.map((line) => {
    const key = line.split('=')[0]?.trim();
    if (key && Object.hasOwn(values, key)) {
      written.add(key);
      return `${key}=${values[key]}`;
    }
    return line;
  });
  for (const [key, value] of Object.entries(values)) {
    if (!written.has(key)) output.push(`${key}=${value}`);
  }
  writeFileSync(file, `${output.join('\n')}\n`);
}

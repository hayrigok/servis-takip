import { chmodSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { upsertEnvFile } from '../../scripts/lib/env';

function tempFile(content?: string): string {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'env-')), '.env');
  if (content !== undefined) writeFileSync(file, content);
  return file;
}

describe('upsertEnvFile', () => {
  it('dosya yoksa oluşturur', () => {
    const file = tempFile();
    upsertEnvFile(file, { A: '1' });
    expect(readFileSync(file, 'utf8')).toBe('A=1\n');
  });

  it('var olan anahtarı günceller, diğer satırlara ve yorumlara dokunmaz', () => {
    const file = tempFile('# yorum\nA=eski\nB=2\n');
    upsertEnvFile(file, { A: 'yeni', C: '3' });
    expect(readFileSync(file, 'utf8')).toBe('# yorum\nA=yeni\nB=2\nC=3\n');
  });

  it('Windows satır sonlarını okur', () => {
    const file = tempFile('A=1\r\nB=2\r\n');
    upsertEnvFile(file, { B: '9' });
    expect(readFileSync(file, 'utf8')).toBe('A=1\nB=9\n');
  });

  // Windows'ta dosya izni klasörün erişim listesinden gelir; bu izin bitleri orada uygulanmaz.
  it.skipIf(process.platform === 'win32')(
    'şifreleri yalnızca dosya sahibinin okuyabileceği izinle yazar',
    () => {
      const created = tempFile();
      upsertEnvFile(created, { A: '1' });
      expect(statSync(created).mode & 0o777).toBe(0o600);

      const existing = tempFile('A=1\n');
      chmodSync(existing, 0o644);
      upsertEnvFile(existing, { B: '2' });
      expect(statSync(existing).mode & 0o777).toBe(0o600);
    },
  );
});

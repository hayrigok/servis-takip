import { describe, expect, it } from 'vitest';
import { assertNoSecrets } from '@/server/audit/audit';

describe('işlem geçmişinde sır yasağı', () => {
  it('olağan ayrıntılara izin verir', () => {
    expect(() =>
      assertNoSecrets({ role: 'owner', changes: { fullName: { from: 'A', to: 'B' } } }),
    ).not.toThrow();
  });
  it.each([{ password: 'x' }, { passwordHash: 'x' }, { token: 'x' }, { changes: { sifre: 'x' } }])(
    'şifre/özet/belirteç anahtarını reddeder: %o',
    (details) => expect(() => assertNoSecrets(details)).toThrow(),
  );
});

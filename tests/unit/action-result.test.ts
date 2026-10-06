import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAction } from '@/server/action-result';
import { conflictError, forbiddenError } from '@/server/errors';

afterEach(() => vi.restoreAllMocks());

describe('runAction', () => {
  it('başarılı sonucu sarar', async () => {
    expect(await runAction(async () => 42)).toEqual({ ok: true, data: 42 });
  });

  it('AppError mesajını ve alan hatalarını kullanıcıya iletir', async () => {
    const result = await runAction(async () => {
      throw conflictError('Bu kullanıcı adı firmanızda zaten kullanılıyor.', {
        username: 'Kullanılıyor.',
      });
    });
    expect(result).toEqual({
      ok: false,
      error: {
        message: 'Bu kullanıcı adı firmanızda zaten kullanılıyor.',
        fieldErrors: { username: 'Kullanılıyor.' },
      },
    });
  });

  it('yetki hatasını Türkçe mesajla döndürür', async () => {
    const result = await runAction(async () => {
      throw forbiddenError();
    });
    expect(result).toEqual({ ok: false, error: { message: 'Bu işlem için yetkiniz yok.' } });
  });

  it('beklenmeyen hatada hata kodu verir, kayda kişisel veri yazmaz', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await runAction(async () => {
      throw new Error('Müşteri Ahmet Yılmaz 05321234567 bulunamadı');
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(
      /^Bir şeyler ters gitti\. Tekrar dener misiniz\? \(Hata kodu: [0-9A-F]{8}\)$/,
    );
    const logged = spy.mock.calls.flat().join(' ');
    expect(logged).not.toContain('Ahmet');
    expect(logged).not.toContain('05321234567');
    expect(logged).toContain(result.error.message.match(/[0-9A-F]{8}/)![0]);
  });
});

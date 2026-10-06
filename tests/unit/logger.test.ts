import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/server/logger';

afterEach(() => vi.restoreAllMocks());

describe('logger', () => {
  it('çok satırlı hata mesajının hiçbir satırını kayda yazmaz', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = logger.error(
      'test_event',
      new Error('Müşteri bulunamadı\nAhmet Yılmaz\n05321234567'),
    );
    const logged = spy.mock.calls.flat().join(' ');
    expect(logged).not.toContain('Ahmet');
    expect(logged).not.toContain('05321234567');
    expect(logged).toContain(code);
    expect(logged).toContain('test_event');
  });

  it('PostgreSQL hata kodunu yazar, ayrıntıyı yazmaz', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = Object.assign(new Error('duplicate key'), {
      code: '23505',
      detail: 'Key (username)=(ahmet) already exists.',
    });
    logger.error('db_failed', err);
    const logged = spy.mock.calls.flat().join(' ');
    expect(logged).toContain('"pgCode":"23505"');
    expect(logged).not.toContain('ahmet');
  });
});

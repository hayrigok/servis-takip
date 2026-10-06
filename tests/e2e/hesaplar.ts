import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

export const ACCOUNTS_FILE = 'tests/e2e/.hesaplar.json';
export const READY_PASSWORD = 'E2e Şifre 2026';

export interface E2eAccount {
  id: string;
  username: string;
  password: string;
  fullName: string;
}

export interface E2eFirm {
  code: string;
  tenantId: string;
  name: string;
  accounts: Record<string, E2eAccount>;
}

export function accounts(): { a: E2eFirm; b: E2eFirm } {
  return JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as { a: E2eFirm; b: E2eFirm };
}

export function account(firm: E2eFirm, key: string): E2eAccount {
  const found = firm.accounts[key];
  if (!found) throw new Error(`E2E hesabı yok: ${firm.code}/${key}`);
  return found;
}

type Credentials = Pick<E2eAccount, 'username' | 'password'>;

/** Formu doldurup gönderir, sonucu beklemez (başarısız giriş testleri için). */
export async function submitLogin(page: Page, firm: E2eFirm, acc: Credentials): Promise<void> {
  await page.goto('/giris');
  const change = page.getByRole('button', { name: 'Firma kodunu değiştir' });
  if (await change.isVisible()) await change.click();
  await page.getByLabel('Firma kodu').fill(firm.code);
  await page.getByLabel('Kullanıcı adı').fill(acc.username);
  await page.getByLabel('Şifre', { exact: true }).fill(acc.password);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
}

/**
 * Sayfaya gider ve akışla gelen içeriği bekler: "load" olayı yükleniyor iskeleti ekrandayken de gelebilir;
 * ölçüm, tarama ve ekran görüntüsü gerçek sayfada yapılmalı.
 */
export async function gotoReady(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Giriş yapar ve giriş sayfasından çıkılmasını bekler; aksi halde sonraki goto girişi yarıda keser. */
export async function loginAs(page: Page, firm: E2eFirm, acc: Credentials): Promise<void> {
  await submitLogin(page, firm, acc);
  await page.waitForURL((url) => url.pathname !== '/giris');
}

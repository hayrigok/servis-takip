import { expect, test } from '@playwright/test';
import { account, accounts, loginAs, submitLogin } from './hesaplar';

test('yanlış şifrede genel hata mesajı gösterir ve girişte kalır', async ({ page }) => {
  const { a } = accounts();
  await submitLogin(page, a, { username: 'patron', password: 'yanlış şifre' });
  // Next.js'in sayfa geçişi duyurucusu da role="alert" taşır; metinle süzülür.
  await expect(
    page.getByRole('alert').filter({ hasText: 'Firma kodu, kullanıcı adı ya da şifre hatalı.' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/giris$/);
});

test('geçici şifreyle ilk giriş şifre belirlemeye yönlendirir, başka sayfaya geçirmez', async ({
  page,
}) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'ilkGiris'));
  await expect(page).toHaveURL(/\/sifre-belirle$/);
  await page.goto('/hesabim');
  await expect(page).toHaveURL(/\/sifre-belirle$/);
  await page.getByLabel('Yeni şifre', { exact: true }).fill('Kombi Tamir 42');
  await page.getByLabel('Yeni şifre (tekrar)').fill('Kombi Tamir 42');
  await page.getByRole('button', { name: 'Şifreyi kaydet' }).click();
  await expect(page.getByRole('heading', { name: 'Hoş geldiniz, Selin Uçar' })).toBeVisible();
});

test('firma kodu hatırlanır; firma kodunu değiştirerek başka firmaya girilir', async ({ page }) => {
  const { a, b } = accounts();
  await loginAs(page, a, account(a, 'operator'));
  await expect(page.getByText(a.name).first()).toBeVisible();
  await page.goto('/hesabim');
  await page.getByRole('button', { name: 'Çıkış yap' }).click();
  await expect(page).toHaveURL(/\/giris$/);
  await expect(page.getByText(`Firma: ${a.code}`)).toBeVisible();

  await loginAs(page, b, account(b, 'operator'));
  await expect(page.getByText(b.name).first()).toBeVisible();
  await page.goto('/hesabim');
  await page.getByRole('button', { name: 'Çıkış yap' }).click();
  await expect(page.getByText(`Firma: ${b.code}`)).toBeVisible();
});

test('çıkıştan sonra korumalı sayfalar girişe yönlendirir', async ({ page }) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'patron'));
  await page.goto('/hesabim');
  await page.getByRole('button', { name: 'Çıkış yap' }).click();
  await page.goto('/personel');
  await expect(page).toHaveURL(/\/giris$/);
});

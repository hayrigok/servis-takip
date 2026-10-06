import { expect, test } from '@playwright/test';
import { account, accounts, loginAs } from './hesaplar';

test('operatör menüde Personel görmez, adresle de giremez', async ({ page }) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'operator'));
  await expect(
    page.getByRole('navigation', { name: 'Ana menü' }).getByRole('link', { name: 'Personel' }),
  ).toHaveCount(0);
  await page.goto('/personel');
  await expect(page.getByRole('heading', { name: 'Bu sayfayı görme yetkiniz yok' })).toBeVisible();
});

test('teknisyen personel ekleme sayfasına giremez', async ({ page }) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'teknisyen'));
  await page.goto('/personel/yeni');
  await expect(page.getByRole('heading', { name: 'Bu sayfayı görme yetkiniz yok' })).toBeVisible();
});

test('A firmasının patronu B firmasının personelini adresle açamaz', async ({ page }) => {
  const { a, b } = accounts();
  await loginAs(page, a, account(a, 'patron'));
  await page.goto(`/personel/${account(b, 'operator').id}`);
  await expect(page.getByRole('heading', { name: 'Sayfa bulunamadı' })).toBeVisible();
  await expect(page.getByText('Can Yıldız')).toHaveCount(0);
});

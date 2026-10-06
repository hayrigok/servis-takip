import { expect, test } from '@playwright/test';
import { account, accounts, loginAs } from './hesaplar';

test('geçersiz çerezle döngü olmadan girişe düşer', async ({ page, context }) => {
  const { a } = accounts();
  await context.addCookies([
    { name: 'oturum', value: `${a.tenantId}.${'x'.repeat(43)}`, domain: 'localhost', path: '/' },
  ]);
  await page.goto('/personel');
  await expect(page).toHaveURL(/\/giris$/);
  await expect(page.getByRole('heading', { name: 'Giriş yap' })).toBeVisible();
});

test('pasifleştirilen kişi bir sonraki istekte dışarı düşer', async ({ browser }) => {
  const { a } = accounts();
  const extra = account(a, 'ekstra');
  const bossContext = await browser.newContext();
  const techContext = await browser.newContext();
  const boss = await bossContext.newPage();
  const tech = await techContext.newPage();

  await loginAs(tech, a, extra);
  await expect(
    tech.getByRole('heading', { name: `Hoş geldiniz, ${extra.fullName}` }),
  ).toBeVisible();

  await loginAs(boss, a, account(a, 'patron'));
  await boss.goto(`/personel/${extra.id}`);
  await boss.getByRole('button', { name: 'Pasifleştir' }).click();
  await boss.getByRole('alertdialog').getByRole('button', { name: 'Pasifleştir' }).click();
  await expect(boss.getByText('Hesap pasifleştirildi.')).toBeVisible();

  await tech.reload();
  await expect(tech).toHaveURL(/\/giris$/);

  // Sonraki testler için geri al.
  await boss.getByRole('button', { name: 'Yeniden etkinleştir' }).click();
  await boss.getByRole('alertdialog').getByRole('button', { name: 'Etkinleştir' }).click();
  await expect(boss.getByText('Hesap yeniden etkinleştirildi.')).toBeVisible();
  await bossContext.close();
  await techContext.close();
});

import { expect, test } from '@playwright/test';
import { account, accounts, loginAs } from './hesaplar';

test('patron personel ekler; geçici şifre gösterilir; yeni kişi onunla girer', async ({
  page,
  browser,
}) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'patron'));
  await page.goto('/personel');
  await page.getByRole('link', { name: 'Personel ekle' }).click();
  await page.getByLabel('Ad soyad').fill('Gülşen Öztürk');
  await page.getByLabel('Kullanıcı adı').fill('Gülşen');
  await expect(page.getByText('Kullanıcı adı "gulsen" olarak kaydedilecek.')).toBeVisible();
  await page.getByLabel('Rol').selectOption({ label: 'Operatör' });
  await page.getByRole('button', { name: 'Hesabı aç' }).click();

  await expect(page.getByText('Hesap açıldı')).toBeVisible();
  const temp = (await page.getByTestId('gecici-sifre').textContent())?.trim() ?? '';
  expect(temp).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);

  const other = await browser.newContext();
  const newcomer = await other.newPage();
  await loginAs(newcomer, a, { username: 'gulsen', password: temp });
  await expect(newcomer).toHaveURL(/\/sifre-belirle$/);
  await other.close();

  await page.goto('/personel');
  await expect(page.getByRole('link', { name: /Gülşen Öztürk/ })).toBeVisible();
});

test('aynı kullanıcı adı alan hatası verir', async ({ page }) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'patron'));
  await page.goto('/personel/yeni');
  await page.getByLabel('Ad soyad').fill('Başka Ayşe');
  await page.getByLabel('Kullanıcı adı').fill('Operator');
  await page.getByRole('button', { name: 'Hesabı aç' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'İşaretli alanları düzeltin.' }),
  ).toBeVisible();
  await expect(page.getByLabel('Kullanıcı adı')).toHaveAccessibleDescription(
    /Bu kullanıcı adı firmanızda zaten kullanılıyor\./,
  );
});

test('şifre sıfırlama onay ister ve yeni geçici şifreyi gösterir', async ({ page }) => {
  const { a } = accounts();
  const extra = account(a, 'ekstra');
  await loginAs(page, a, account(a, 'patron'));
  await page.goto(`/personel/${extra.id}`);
  await page.getByRole('button', { name: 'Şifreyi sıfırla' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Şifre sıfırlansın mı?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Vazgeç' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Şifreyi sıfırla' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Şifreyi sıfırla' }).click();
  await expect(page.getByText('Şifre sıfırlandı')).toBeVisible();
  await expect(page.getByTestId('gecici-sifre')).toHaveText(
    /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/,
  );
});

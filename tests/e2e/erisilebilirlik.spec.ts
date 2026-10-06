import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { account, accounts, gotoReady, loginAs, type E2eFirm } from './hesaplar';

interface Screen {
  name: string;
  as: string | null;
  path: (firm: E2eFirm) => string;
}

const SCREENS: Screen[] = [
  { name: 'giriş', as: null, path: () => '/giris' },
  { name: 'şifre belirleme', as: 'ilkGirisBekleyen', path: () => '/sifre-belirle' },
  { name: 'ana sayfa (patron)', as: 'patron', path: () => '/' },
  { name: 'ana sayfa (teknisyen)', as: 'teknisyen', path: () => '/' },
  { name: 'Hesabım', as: 'patron', path: () => '/hesabim' },
  { name: 'personel listesi', as: 'patron', path: () => '/personel' },
  { name: 'personel ekle', as: 'patron', path: () => '/personel/yeni' },
  {
    name: 'personel ayrıntısı',
    as: 'patron',
    path: (f) => `/personel/${account(f, 'operator').id}`,
  },
  { name: 'yetkisiz', as: 'operator', path: () => '/personel' },
];

for (const colorScheme of ['light', 'dark'] as const) {
  for (const screen of SCREENS) {
    test(`${screen.name} (${colorScheme === 'light' ? 'açık' : 'koyu'}) WCAG 2.2 AA ihlali yok`, async ({
      page,
    }) => {
      const { a } = accounts();
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      if (screen.as) await loginAs(page, a, account(a, screen.as));
      await gotoReady(page, screen.path(a));
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);
    });
  }
}

test('giriş formu yalnızca klavyeyle doldurulup gönderilir', async ({ page }) => {
  const { a } = accounts();
  await page.goto('/giris');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Firma kodu')).toBeFocused();
  await page.keyboard.type(a.code);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Kullanıcı adı')).toBeFocused();
  await page.keyboard.type('patron');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Şifre', { exact: true })).toBeFocused();
  await page.keyboard.type(account(a, 'patron').password);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Şifreyi göster' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Giriş yap' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /^Hoş geldiniz/ })).toBeVisible();
});

import { expect, test } from '@playwright/test';
import { account, accounts, gotoReady, loginAs, type E2eFirm } from './hesaplar';

const OUT = 'tests/e2e/ekran-goruntuleri';
const WIDTHS = [360, 768, 1280] as const;

const SCREENS: Array<{ name: string; as: string | null; path: (f: E2eFirm) => string }> = [
  { name: 'giris', as: null, path: () => '/giris' },
  { name: 'sifre-belirle', as: 'ilkGirisBekleyen', path: () => '/sifre-belirle' },
  { name: 'ana-sayfa-patron', as: 'patron', path: () => '/' },
  { name: 'ana-sayfa-teknisyen', as: 'teknisyen', path: () => '/' },
  { name: 'hesabim', as: 'patron', path: () => '/hesabim' },
  { name: 'personel', as: 'patron', path: () => '/personel' },
  { name: 'personel-yeni', as: 'patron', path: () => '/personel/yeni' },
  { name: 'personel-ayrinti', as: 'patron', path: (f) => `/personel/${account(f, 'operator').id}` },
  { name: 'yetkisiz', as: 'operator', path: () => '/personel' },
  {
    name: 'bulunamadi',
    as: 'patron',
    path: () => '/personel/00000000-0000-7000-8000-000000000000',
  },
];

test.describe.configure({ mode: 'serial' });

for (const screen of SCREENS) {
  test(`ekran görüntüleri: ${screen.name}`, async ({ page }) => {
    const { a } = accounts();
    if (screen.as) await loginAs(page, a, account(a, screen.as));
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await gotoReady(page, screen.path(a));
        await page.screenshot({
          path: `${OUT}/${screen.name}-${width}-${colorScheme === 'light' ? 'acik' : 'koyu'}.png`,
          fullPage: true,
        });
      }
    }
  });

  test(`büyük yazı (%200), 360 px: ${screen.name} yatay kaydırmasız`, async ({ page }) => {
    const { a } = accounts();
    if (screen.as) await loginAs(page, a, account(a, screen.as));
    await page.setViewportSize({ width: 360, height: 900 });
    await gotoReady(page, screen.path(a));
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    await page.screenshot({ path: `${OUT}/${screen.name}-360-buyuk-yazi.png`, fullPage: true });
    // Alt menü etiketleri sekmesine sığar, komşusuna yapışmaz (iki yanda en az 4 px).
    const crampedTabs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('nav[aria-label="Ana menü"] a'))
        .filter((link) => link.getClientRects().length > 0)
        .flatMap((link) => {
          const range = document.createRange();
          range.selectNodeContents(link);
          const text = range.getBoundingClientRect();
          const box = link.getBoundingClientRect();
          const room = Math.min(text.left - box.left, box.right - text.right);
          return room < 4 ? [`${link.textContent}: ${Math.round(room)} px`] : [];
        }),
    );
    expect(crampedTabs).toEqual([]);
    // İçerik kutusundan taşıp komşusunun üstüne binmez (ör. rozet ok simgesinin altına girmez).
    const spilling = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('main *'))
        .filter(
          (el) =>
            el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible',
        )
        .map(
          (el) =>
            `${el.tagName.toLowerCase()}.${el.className}: ${el.scrollWidth - el.clientWidth} px`,
        ),
    );
    expect(spilling).toEqual([]);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

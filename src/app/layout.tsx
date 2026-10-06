import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import './globals.css';

// Derleme sırasında indirilir, kendi sunucumuzdan verilir: kullanıcının tarayıcısı Google'a bağlanmaz.
// Genişlik ekseni (wdth) dar başlıklar için (docs/TASARIM-SISTEMI.md).
const appFont = Archivo({
  subsets: ['latin', 'latin-ext'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-app',
});

export const metadata: Metadata = {
  title: { default: 'Servis Takip', template: '%s | Servis Takip' },
  description: 'Servis firmaları için iş ve teknisyen takibi',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={appFont.variable}>
      <body>{children}</body>
    </html>
  );
}

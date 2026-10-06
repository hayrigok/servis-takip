import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Servis Takip',
  description: 'Servis firmaları için iş ve teknisyen takibi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}

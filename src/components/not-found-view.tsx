import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from './ui/button';

export function NotFoundView() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <SearchX className="mx-auto size-10 text-fg-muted" aria-hidden="true" />
      <h1 className="mt-4 type-display text-2xl break-words text-fg">Sayfa bulunamadı</h1>
      <p className="mt-2 text-base text-fg-muted">Aradığınız sayfa yok ya da kaldırılmış.</p>
      <Link href="/" className={`${buttonClass('secondary')} mt-6`}>
        Ana sayfaya dön
      </Link>
    </div>
  );
}

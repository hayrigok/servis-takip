import { Lock } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from './ui/button';

export function ForbiddenView() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <Lock className="mx-auto size-10 text-fg-muted" aria-hidden="true" />
      <h1 className="mt-4 type-display text-2xl text-fg">Bu sayfayı görme yetkiniz yok</h1>
      <p className="mt-2 text-base text-fg-muted">
        Bir yanlışlık olduğunu düşünüyorsanız firmanızın patronuyla görüşün.
      </p>
      <Link href="/" className={`${buttonClass('secondary')} mt-6`}>
        Ana sayfaya dön
      </Link>
    </div>
  );
}

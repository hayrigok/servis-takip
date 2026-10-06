import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-2 inline-flex min-h-12 items-center gap-1 text-base font-bold text-primary"
    >
      <ChevronLeft className="size-5" aria-hidden="true" />
      {children}
    </Link>
  );
}

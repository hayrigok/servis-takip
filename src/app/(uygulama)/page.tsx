import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { requireSession } from '@/server/auth/current-user';
import { navItemsFor } from '@/server/navigation';
import { ROLE_LABELS } from '@/server/roles';

export const metadata: Metadata = { title: 'Ana sayfa' };

export default async function HomePage() {
  const session = await requireSession();
  const sections = navItemsFor(session.user.role).filter((item) => item.href !== '/');
  return (
    <>
      <PageHeader
        title={`Hoş geldiniz, ${session.user.fullName}`}
        description={`${session.tenant.name} · ${ROLE_LABELS[session.user.role]}`}
      />
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {sections.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-20 items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-card hover:bg-surface-muted"
            >
              <span>
                <span className="block type-display text-xl text-fg">{item.label}</span>
                <span className="block text-base text-fg-muted">{item.description}</span>
              </span>
              <ChevronRight className="size-6 shrink-0 text-fg-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

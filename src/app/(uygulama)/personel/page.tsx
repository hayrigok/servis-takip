import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ForbiddenView } from '@/components/forbidden-view';
import { buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { actorFromSession } from '@/server/auth/actor';
import { requireSession } from '@/server/auth/current-user';
import { systemClock } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';
import { can } from '@/server/permissions';
import { listStaff } from '@/server/staff/service';
import { StaffCard } from './staff-card';

export const metadata: Metadata = { title: 'Personel' };

const TABS = [
  { status: 'active', label: 'Etkin', href: '/personel' },
  { status: 'inactive', label: 'Pasif', href: '/personel?durum=pasif' },
] as const;

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, 'staff.view')) return <ForbiddenView />;
  const status = (await searchParams).durum === 'pasif' ? 'inactive' : 'active';
  const actor = actorFromSession(session);
  const staff = await withTenant(getDb(), actor.tenantId, (tx) =>
    listStaff(tx, actor, { status }, systemClock),
  );

  return (
    <>
      <PageHeader
        title="Personel"
        description="Firmanızdaki hesaplar"
        actions={
          <Link href="/personel/yeni" className={buttonClass('primary')}>
            <Plus className="size-5" aria-hidden="true" />
            Personel ekle
          </Link>
        }
      />
      <nav aria-label="Personel durumu" className="mt-4">
        <ul className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <li key={tab.status}>
              <Link
                href={tab.href}
                aria-current={status === tab.status ? 'page' : undefined}
                className={`inline-flex min-h-12 items-center rounded-control border-2 px-5 text-base ${
                  status === tab.status
                    ? 'border-primary bg-primary font-extrabold text-primary-fg'
                    : 'border-border-strong bg-surface font-semibold text-fg hover:bg-surface-muted'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {staff.length === 0 ? (
        <EmptyState
          title={status === 'active' ? 'Henüz personel yok' : 'Pasif personel yok'}
          description={
            status === 'active'
              ? 'İlk hesabı açmak için "Personel ekle" düğmesine dokunun.'
              : 'Pasifleştirdiğiniz hesaplar burada görünür.'
          }
        />
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {staff.map((s) => (
            <li key={s.id}>
              <StaffCard staff={s} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

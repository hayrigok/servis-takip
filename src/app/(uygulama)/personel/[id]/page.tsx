import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ForbiddenView } from '@/components/forbidden-view';
import { Badge } from '@/components/ui/badge';
import { BackLink } from '@/components/ui/back-link';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';
import { actorFromSession } from '@/server/auth/actor';
import { requireSession } from '@/server/auth/current-user';
import { systemClock } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';
import { AppError } from '@/server/errors';
import { can } from '@/server/permissions';
import { ROLE_LABELS, ROLE_OPTIONS } from '@/server/roles';
import { getStaff } from '@/server/staff/service';
import { updateStaffAction } from '../actions';
import { EditStaffForm } from './edit-staff-form';
import { StaffActions } from './staff-actions';

export const metadata: Metadata = { title: 'Personel ayrıntısı' };

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!can(session.user.role, 'staff.view')) return <ForbiddenView />;
  const { id } = await params;
  const actor = actorFromSession(session);
  const staff = await withTenant(getDb(), actor.tenantId, (tx) =>
    getStaff(tx, actor, id, systemClock),
  ).catch((err: unknown) => {
    // Başka firmanın kaydı da "bulunamadı": kaydın varlığı belli edilmez.
    if (err instanceof AppError && err.kind === 'not_found') notFound();
    throw err;
  });

  return (
    <>
      <BackLink href="/personel">Personel</BackLink>
      <PageHeader
        title={staff.fullName}
        description={`${staff.username} · ${ROLE_LABELS[staff.role]}`}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {!staff.isActive && <Badge tone="warning">Pasif</Badge>}
        {staff.isLocked && <Badge tone="danger">Kilitli: şifreyi sıfırlamak kilidi açar</Badge>}
        {staff.fieldWork && <Badge tone="primary">Sahaya çıkar</Badge>}
      </div>
      <p className="mt-2 text-sm text-fg-muted">
        {staff.lastLoginAt
          ? `Son giriş: ${formatDateTime(staff.lastLoginAt)}`
          : 'Henüz giriş yapmadı'}{' '}
        · Hesap açılışı: {formatDateTime(staff.createdAt)}
      </p>
      <div className="mt-6 grid max-w-xl gap-6">
        <Card>
          <h2 className="mb-4 type-display text-xl text-fg">Bilgiler</h2>
          <EditStaffForm
            action={updateStaffAction.bind(null, staff.id)}
            roleOptions={ROLE_OPTIONS}
            fullName={staff.fullName}
            role={staff.role}
            fieldWork={staff.fieldWork}
            isSelf={staff.isSelf}
          />
        </Card>
        <Card>
          <h2 className="mb-4 type-display text-xl text-fg">Hesap işlemleri</h2>
          {staff.isSelf ? (
            <p className="text-base text-fg-muted">
              Kendi şifrenizi{' '}
              <Link href="/hesabim" className="font-bold text-primary underline underline-offset-4">
                Hesabım
              </Link>{' '}
              sayfasından değiştirebilirsiniz.
            </p>
          ) : (
            <StaffActions
              id={staff.id}
              fullName={staff.fullName}
              username={staff.username}
              isActive={staff.isActive}
            />
          )}
        </Card>
      </div>
    </>
  );
}

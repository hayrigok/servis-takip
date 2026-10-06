import type { Metadata } from 'next';
import { ForbiddenView } from '@/components/forbidden-view';
import { BackLink } from '@/components/ui/back-link';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireSession } from '@/server/auth/current-user';
import { can } from '@/server/permissions';
import { ROLE_OPTIONS } from '@/server/roles';
import { CreateStaffForm } from './create-staff-form';

export const metadata: Metadata = { title: 'Personel ekle' };

export default async function NewStaffPage() {
  const session = await requireSession();
  if (!can(session.user.role, 'staff.manage')) return <ForbiddenView />;
  return (
    <>
      <BackLink href="/personel">Personel</BackLink>
      <PageHeader
        title="Personel ekle"
        description="Hesap geçici şifreyle açılır; kişi ilk girişte kendi şifresini belirler."
      />
      <Card className="mt-6 max-w-xl">
        <CreateStaffForm roleOptions={ROLE_OPTIONS} />
      </Card>
    </>
  );
}

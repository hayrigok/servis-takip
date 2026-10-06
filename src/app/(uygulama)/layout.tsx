import { AppShell } from '@/components/app-shell';
import { requireSession } from '@/server/auth/current-user';
import { navItemsFor } from '@/server/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <AppShell
      tenantName={session.tenant.name}
      userName={session.user.fullName}
      navItems={navItemsFor(session.user.role)}
    >
      {children}
    </AppShell>
  );
}

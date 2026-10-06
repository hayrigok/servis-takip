import { Wrench } from 'lucide-react';
import type { NavItem } from '@/server/navigation';
import { NavLinks } from './nav-links';

interface AppShellProps {
  tenantName: string;
  userName: string;
  navItems: NavItem[];
  children: React.ReactNode;
}

/** Saha yönünün imzası: koyu üst bant ve altında 4 px sarı şerit (docs/TASARIM-SISTEMI.md). */
export function AppShell({ tenantName, userName, navItems, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:text-fg"
      >
        İçeriğe geç
      </a>
      <header className="border-b-4 border-signal bg-band">
        <div className="mx-auto flex max-w-5xl items-stretch justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3 py-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-control bg-signal text-signal-fg"
              aria-hidden="true"
            >
              <Wrench className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate type-display text-xl text-band-fg">{tenantName}</p>
              <p className="truncate text-sm text-band-muted">{userName}</p>
            </div>
          </div>
          <NavLinks items={navItems} variant="top" />
        </div>
      </header>
      <main id="icerik" className="mx-auto max-w-5xl px-4 pt-6 pb-28 md:pb-12">
        {children}
      </main>
      <NavLinks items={navItems} variant="bottom" />
    </div>
  );
}

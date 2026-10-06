'use client';

import { House, UserRound, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/server/navigation';

const ICONS = { home: House, staff: Users, account: UserRound } as const;

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Masaüstünde üst bantta menü, telefonda başparmakla erişilen alt menü (ikisi de koyu bantta).
 * Etkin öğe yalnızca renkle değil: sarı şerit, kalın yazı ve aria-current ile belirtilir.
 */
export function NavLinks({ items, variant }: { items: NavItem[]; variant: 'top' | 'bottom' }) {
  const pathname = usePathname();
  if (variant === 'top') {
    return (
      <nav aria-label="Ana menü" className="hidden self-stretch md:flex">
        <ul className="flex">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-12 items-center border-b-4 px-3.5 text-base ${
                    active
                      ? 'border-band-fg font-extrabold text-band-fg'
                      : 'border-transparent font-semibold text-band-muted hover:text-band-fg'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
  return (
    <nav
      aria-label="Ana menü"
      className="fixed inset-x-0 bottom-0 z-40 bg-band pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 border-t-4 text-sm ${
                  active
                    ? 'border-signal font-extrabold text-band-fg'
                    : 'border-transparent font-semibold text-band-muted'
                }`}
              >
                <Icon className="size-6" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

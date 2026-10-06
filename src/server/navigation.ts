import { can, type Permission } from './permissions';
import type { Role } from './roles';

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: 'home' | 'staff' | 'account';
}

const ITEMS: ReadonlyArray<{ item: NavItem; permission?: Permission }> = [
  { item: { href: '/', label: 'Ana sayfa', description: 'Özet ve kısayollar', icon: 'home' } },
  {
    item: {
      href: '/personel',
      label: 'Personel',
      description: 'Hesap açın; rolleri, şifreleri ve erişimi yönetin.',
      icon: 'staff',
    },
    permission: 'staff.view',
  },
  {
    item: {
      href: '/hesabim',
      label: 'Hesabım',
      description: 'Şifrenizi değiştirin ya da çıkış yapın.',
      icon: 'account',
    },
  },
];

/** Menü yalnızca kolaylıktır; asıl yetki kontrolü sunucu eylemlerinde ve sayfalarda. */
export function navItemsFor(role: Role): NavItem[] {
  return ITEMS.filter((entry) => !entry.permission || can(role, entry.permission)).map(
    (entry) => entry.item,
  );
}

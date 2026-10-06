import { describe, expect, it } from 'vitest';
import { navItemsFor } from '@/server/navigation';

describe('menü', () => {
  it('patron Personel bölümünü görür', () => {
    expect(navItemsFor('owner').map((i) => i.href)).toEqual(['/', '/personel', '/hesabim']);
  });
  it.each(['operator', 'technician'] as const)('%s Personel bölümünü görmez', (role) => {
    expect(navItemsFor(role).map((i) => i.href)).toEqual(['/', '/hesabim']);
  });
});

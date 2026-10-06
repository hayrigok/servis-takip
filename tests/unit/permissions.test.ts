import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, can, requirePermission, type Permission } from '@/server/permissions';
import { ROLES, type Role } from '@/server/roles';

/**
 * CLAUDE.md "Roller ve yetkiler" tablosunun bağımsız kopyası. Kod tablosu değişirse bu test,
 * CLAUDE.md'nin de güncellenmesini hatırlatır. Sonraki parçalar buraya satır ekler.
 */
const EXPECTED: Record<Permission, Record<Role, boolean>> = {
  'staff.view': { owner: true, operator: false, technician: false },
  'staff.manage': { owner: true, operator: false, technician: false },
};

describe('yetki tablosu', () => {
  it('kodda tanımlı izinler beklenen tabloyla aynı', () => {
    expect([...ALL_PERMISSIONS].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const permission of Object.keys(EXPECTED) as Permission[]) {
    for (const role of ROLES) {
      it(`${permission} → ${role}: ${EXPECTED[permission][role] ? 'izinli' : 'yasak'}`, () => {
        expect(can(role, permission)).toBe(EXPECTED[permission][role]);
        if (EXPECTED[permission][role]) {
          expect(() => requirePermission({ role }, permission)).not.toThrow();
        } else {
          expect(() => requirePermission({ role }, permission)).toThrow(
            'Bu işlem için yetkiniz yok.',
          );
        }
      });
    }
  }
});

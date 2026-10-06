import { forbiddenError } from './errors';
import type { Role } from './roles';

/** Sunucudaki tek yetki tablosu. CLAUDE.md "Roller ve yetkiler" tablosuyla birebir aynı olmalı. */
const PERMISSIONS = {
  'staff.view': ['owner'],
  'staff.manage': ['owner'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function requirePermission(actor: { role: Role }, permission: Permission): void {
  if (!can(actor.role, permission)) throw forbiddenError();
}

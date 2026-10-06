export const ROLES = ['owner', 'operator', 'technician'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  owner: 'Patron',
  operator: 'Operatör',
  technician: 'Teknisyen',
};

/** Rol seçim kutuları için; istemci bileşenlerine sunucu sayfasından prop olarak verilir. */
export const ROLE_OPTIONS: ReadonlyArray<{ value: Role; label: string }> = ROLES.map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

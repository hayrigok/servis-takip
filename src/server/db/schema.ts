import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { ROLES } from '../roles';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const TENANT_STATUSES = ['active', 'suspended'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

/** Platform tablosu: firmanın kendisi. tenant_id sütunu yoktur; kişisel veri içermez. */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    code: text('code').notNull().unique('tenants_code_key'),
    name: text('name').notNull(),
    status: text('status', { enum: TENANT_STATUSES }).notNull().default('active'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('tenants_code_format', sql`${t.code} ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'`),
    check('tenants_name_length', sql`char_length(${t.name}) between 1 and 80`),
    check('tenants_status_values', sql`${t.status} in ('active', 'suspended')`),
  ],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    username: text('username').notNull(),
    fullName: text('full_name').notNull(),
    role: text('role', { enum: ROLES }).notNull(),
    fieldWork: boolean('field_work').notNull().default(false),
    passwordHash: text('password_hash').notNull(),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamptz('locked_until'),
    lastLoginAt: timestamptz('last_login_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('users_tenant_username_key').on(t.tenantId, t.username),
    // Bileşik anahtar hedefi: diğer firma tabloları (tenant_id, user_id) ile bağlanır.
    unique('users_tenant_id_key').on(t.tenantId, t.id),
    check('users_username_format', sql`${t.username} ~ '^[a-z0-9._-]{3,30}$'`),
    check('users_full_name_length', sql`char_length(${t.fullName}) between 1 and 80`),
    check('users_role_values', sql`${t.role} in ('owner', 'operator', 'technician')`),
    check('users_technician_field_work', sql`${t.role} <> 'technician' or ${t.fieldWork}`),
    check('users_failed_attempts_nonnegative', sql`${t.failedAttempts} >= 0`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    /** Çerezdeki belirtecin SHA-256 özeti (hex). Belirtecin kendisi saklanmaz. */
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: 'sessions_user_fk',
      columns: [t.tenantId, t.userId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete('cascade'),
    index('sessions_tenant_user_idx').on(t.tenantId, t.userId),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    actorUserId: uuid('actor_user_id'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: uuid('target_id'),
    details: jsonb('details')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: 'audit_log_actor_fk',
      columns: [t.tenantId, t.actorUserId],
      foreignColumns: [users.tenantId, users.id],
    }),
    index('audit_log_tenant_created_idx').on(t.tenantId, t.createdAt),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

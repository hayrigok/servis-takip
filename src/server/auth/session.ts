import { createHash, randomBytes } from 'node:crypto';
import { and, eq, lte, ne } from 'drizzle-orm';
import type { Clock } from '@/server/clock';
import type { Db } from '@/server/db/pool';
import { sessions, tenants, users } from '@/server/db/schema';
import { isUuid, withTenant, type TenantTx } from '@/server/db/tenant';
import type { Role } from '@/server/roles';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface SessionUser {
  id: string;
  tenantId: string;
  username: string;
  fullName: string;
  role: Role;
  fieldWork: boolean;
  mustChangePassword: boolean;
}

export interface ValidSession {
  /** sessions.id: belirtecin özeti. */
  sessionId: string;
  expiresAt: Date;
  user: SessionUser;
  tenant: { id: string; code: string; name: string };
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Çerez değeri "<tenantId>.<belirteç>". Firma kimliği gizli değildir; oturumu firma bağlamında aramaya yarar. */
export function encodeSessionCookie(tenantId: string, token: string): string {
  return `${tenantId}.${token}`;
}

export function decodeSessionCookie(
  value: string | undefined,
): { tenantId: string; token: string } | null {
  if (!value) return null;
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  const tenantId = value.slice(0, dot);
  const token = value.slice(dot + 1);
  if (!isUuid(tenantId) || !TOKEN_PATTERN.test(token)) return null;
  return { tenantId, token };
}

export async function createSession(
  tx: TenantTx,
  user: { id: string; tenantId: string },
  clock: Clock,
): Promise<{ token: string; expiresAt: Date }> {
  const now = clock.now();
  // Süresi dolmuş eski oturumlar tutulmaz (gereksiz veri saklanmaz).
  await tx
    .delete(sessions)
    .where(
      and(
        eq(sessions.tenantId, user.tenantId),
        eq(sessions.userId, user.id),
        lte(sessions.expiresAt, now),
      ),
    );
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await tx.insert(sessions).values({
    id: hashSessionToken(token),
    tenantId: user.tenantId,
    userId: user.id,
    expiresAt,
    createdAt: now,
  });
  return { token, expiresAt };
}

export async function validateSession(
  db: Db,
  cookieValue: string | undefined,
  clock: Clock,
): Promise<ValidSession | null> {
  const parsed = decodeSessionCookie(cookieValue);
  if (!parsed) return null;
  const sessionId = hashSessionToken(parsed.token);
  const bySession = and(eq(sessions.tenantId, parsed.tenantId), eq(sessions.id, sessionId));

  return withTenant(db, parsed.tenantId, async (tx) => {
    const [row] = await tx
      .select({
        expiresAt: sessions.expiresAt,
        userId: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        fieldWork: users.fieldWork,
        mustChangePassword: users.mustChangePassword,
        isActive: users.isActive,
        tenantCode: tenants.code,
        tenantName: tenants.name,
        tenantStatus: tenants.status,
      })
      .from(sessions)
      .innerJoin(users, and(eq(users.tenantId, sessions.tenantId), eq(users.id, sessions.userId)))
      .innerJoin(tenants, eq(tenants.id, sessions.tenantId))
      .where(bySession)
      .limit(1);
    if (!row) return null;

    const now = clock.now();
    if (row.expiresAt <= now || !row.isActive || row.tenantStatus !== 'active') {
      await tx.delete(sessions).where(bySession);
      return null;
    }

    let expiresAt = row.expiresAt;
    if (expiresAt.getTime() - now.getTime() < SESSION_RENEW_THRESHOLD_MS) {
      expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
      await tx.update(sessions).set({ expiresAt }).where(bySession);
    }

    return {
      sessionId,
      expiresAt,
      user: {
        id: row.userId,
        tenantId: parsed.tenantId,
        username: row.username,
        fullName: row.fullName,
        role: row.role,
        fieldWork: row.fieldWork,
        mustChangePassword: row.mustChangePassword,
      },
      tenant: { id: parsed.tenantId, code: row.tenantCode, name: row.tenantName },
    };
  });
}

export async function deleteSession(
  tx: TenantTx,
  tenantId: string,
  sessionId: string,
): Promise<void> {
  await tx.delete(sessions).where(and(eq(sessions.tenantId, tenantId), eq(sessions.id, sessionId)));
}

export async function deleteUserSessions(
  tx: TenantTx,
  tenantId: string,
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  const conditions = [eq(sessions.tenantId, tenantId), eq(sessions.userId, userId)];
  if (exceptSessionId) conditions.push(ne(sessions.id, exceptSessionId));
  const removed = await tx
    .delete(sessions)
    .where(and(...conditions))
    .returning({ id: sessions.id });
  return removed.length;
}

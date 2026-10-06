import type { Role } from '@/server/roles';
import type { ValidSession } from './session';

/** İşlemi yapan kişi. Servisler firma ve yetki kararını bundan verir. */
export interface Actor {
  tenantId: string;
  tenantCode: string;
  userId: string;
  username: string;
  role: Role;
  /** Mevcut oturumun kimliği (sessions.id); komut satırında null. */
  sessionId: string | null;
}

export function actorFromSession(session: ValidSession): Actor {
  return {
    tenantId: session.tenant.id,
    tenantCode: session.tenant.code,
    userId: session.user.id,
    username: session.user.username,
    role: session.user.role,
    sessionId: session.sessionId,
  };
}

import type { Pool } from 'pg';

import type { SessionRecord } from '../../domain/contracts/authentication.js';
import type { SessionRepository } from '../../domain/contracts/repositories.js';
import { withTenantContext } from '../../infrastructure/database/tenant-context.js';

export interface AuditLogRecord {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  correlationId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export class SecurityAdministrationService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly pool: Pool,
    private readonly tenantContextKey = 'app.current_tenant_id',
  ) {}

  listActiveSessions(tenantId: string, userId?: string): Promise<SessionRecord[]> {
    return this.sessions.listActiveSessions(tenantId, userId);
  }

  revokeSession(sessionId: string, tenantId: string): Promise<void> {
    return this.sessions.invalidateSession(sessionId, tenantId);
  }

  revokeAllSessions(tenantId: string, userId: string, exceptSessionId?: string): Promise<number> {
    return this.sessions.invalidateAllSessions(tenantId, userId, exceptSessionId);
  }

  async listAuditLogs(tenantId: string, limit: number, offset: number): Promise<AuditLogRecord[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, (client) =>
      client.query(
        `SELECT id, tenant_id as "tenantId", actor_user_id as "actorUserId",
                action, resource_type as "resourceType", resource_id as "resourceId",
                outcome, correlation_id as "correlationId", metadata, created_at as "createdAt"
         FROM audit_events
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset],
      ),
    );

    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      actorUserId: row.actorUserId ?? null,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId ?? null,
      outcome: row.outcome,
      correlationId: row.correlationId ?? null,
      metadata: row.metadata ?? {},
      createdAt: new Date(row.createdAt),
    }));
  }
}

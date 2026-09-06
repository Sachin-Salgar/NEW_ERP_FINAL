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

export interface SecurityPolicy {
  tenantId: string;
  mfaRequired: boolean;
  sessionLifetimeMinutes: number;
  maxFailedLoginAttempts: number;
  lockoutMinutes: number;
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

  async exportAuditLogs(tenantId: string, limit: number): Promise<string> {
    const logs = await this.listAuditLogs(tenantId, limit, 0);
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    return [
      'id,actorUserId,action,resourceType,resourceId,outcome,correlationId,createdAt',
      ...logs.map((log) => [log.id, log.actorUserId, log.action, log.resourceType, log.resourceId, log.outcome, log.correlationId, log.createdAt.toISOString()].map(quote).join(',')),
    ].join('\n');
  }

  async getSecurityPolicy(tenantId: string): Promise<SecurityPolicy> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, (client) =>
      client.query(`SELECT tenant_id as "tenantId", mfa_required as "mfaRequired", session_lifetime_minutes as "sessionLifetimeMinutes",
                           max_failed_login_attempts as "maxFailedLoginAttempts", lockout_minutes as "lockoutMinutes"
                    FROM security_policies WHERE tenant_id = $1`, [tenantId]),
    );
    if (result.rows.length === 0) {
      return { tenantId, mfaRequired: false, sessionLifetimeMinutes: 60 * 24 * 30, maxFailedLoginAttempts: 5, lockoutMinutes: 15 };
    }
    return result.rows[0] as SecurityPolicy;
  }

  async updateSecurityPolicy(tenantId: string, changes: Partial<Omit<SecurityPolicy, 'tenantId'>>): Promise<SecurityPolicy> {
    const current = await this.getSecurityPolicy(tenantId);
    const next = { ...current, ...changes };
    if (next.sessionLifetimeMinutes < 5 || next.sessionLifetimeMinutes > 43200 || next.maxFailedLoginAttempts < 1 || next.maxFailedLoginAttempts > 20 || next.lockoutMinutes < 1 || next.lockoutMinutes > 1440) {
      throw new Error('Security policy values are outside the supported range.');
    }
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, (client) =>
      client.query(
        `INSERT INTO security_policies (tenant_id, mfa_required, session_lifetime_minutes, max_failed_login_attempts, lockout_minutes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id) DO UPDATE SET mfa_required = EXCLUDED.mfa_required,
           session_lifetime_minutes = EXCLUDED.session_lifetime_minutes,
           max_failed_login_attempts = EXCLUDED.max_failed_login_attempts,
           lockout_minutes = EXCLUDED.lockout_minutes, updated_at = NOW()`,
        [tenantId, next.mfaRequired, next.sessionLifetimeMinutes, next.maxFailedLoginAttempts, next.lockoutMinutes],
      ),
    );
    return next;
  }
}

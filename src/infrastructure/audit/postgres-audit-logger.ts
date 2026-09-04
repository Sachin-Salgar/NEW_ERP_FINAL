import type { Pool, PoolClient } from 'pg';

import type { AuditEvent, AuditLogger, AuditMetadata, AuditRecordOptions } from '../../application/contracts/audit.js';
import { getTransactionContext } from '../database/transaction-context.js';
import { withTenantContext } from '../database/tenant-context.js';

const INSERT_AUDIT_EVENT_SQL = `
  INSERT INTO audit_events (
    tenant_id,
    actor_user_id,
    action,
    resource_type,
    resource_id,
    outcome,
    correlation_id,
    metadata
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
`;

export interface PostgresAuditLoggerOptions {
  tenantContextKey: string;
  allowedMetadataKeys?: readonly string[];
}

/**
 * PostgreSQL-backed audit logger.
 *
 * When called inside UnitOfWork, withTenantContext reuses the active client and
 * therefore keeps security-critical audit records in the same transaction as
 * the protected mutation. Outside UnitOfWork it opens a short tenant-scoped
 * transaction for the append-only audit write.
 */
export class PostgresAuditLogger implements AuditLogger {
  private readonly allowedMetadataKeys: ReadonlySet<string>;

  constructor(
    private readonly pool: Pool,
    private readonly options: PostgresAuditLoggerOptions,
  ) {
    this.allowedMetadataKeys = new Set(options.allowedMetadataKeys ?? []);
  }

  async record(event: AuditEvent, options: AuditRecordOptions = {}): Promise<void> {
    const activeTransaction = getTransactionContext();

    if (options.requireTransaction && !activeTransaction) {
      throw new Error('A security-critical audit event requires an active transaction');
    }

    const metadata = filterMetadata(event.metadata, this.allowedMetadataKeys);

    await withTenantContext(
      this.pool,
      this.options.tenantContextKey,
      event.tenantId,
      async (client) => this.insert(client, event, metadata),
      {
        tenantId: event.tenantId,
        userId: event.actorUserId ?? undefined,
      },
    );
  }

  private async insert(client: PoolClient, event: AuditEvent, metadata: AuditMetadata): Promise<void> {
    await client.query(INSERT_AUDIT_EVENT_SQL, [
      event.tenantId,
      event.actorUserId ?? null,
      event.action,
      event.resourceType,
      event.resourceId ?? null,
      event.outcome,
      event.correlationId ?? null,
      JSON.stringify(metadata),
    ]);
  }
}

export function filterMetadata(metadata: AuditMetadata | undefined, allowedKeys: ReadonlySet<string>): AuditMetadata {
  if (!metadata || allowedKeys.size === 0) {
    return {};
  }

  return Object.fromEntries(Object.entries(metadata).filter(([key]) => allowedKeys.has(key))) as AuditMetadata;
}

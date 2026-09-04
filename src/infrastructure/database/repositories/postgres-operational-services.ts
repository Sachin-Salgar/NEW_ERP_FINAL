import type { Pool } from 'pg';

import type {
  DomainEvent,
  DomainEventPublisher,
  FileMetadataRecord,
  FileMetadataRepository,
  NotificationRequest,
  NotificationServicePort,
  ScheduledJobRequest,
  SchedulerServicePort,
} from '../../../application/contracts/operational-services.js';
import { getTransactionContext } from '../transaction-context.js';
import { withTenantContext } from '../tenant-context.js';

export class PostgresNotificationService implements NotificationServicePort {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey: string,
  ) {}

  async enqueue(request: NotificationRequest): Promise<string> {
    return withTenantContext(this.pool, this.tenantContextKey, request.tenantId, async (client) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO notifications (
           tenant_id, user_id, channel, template_key, recipient, payload, available_at
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
         RETURNING id`,
        [
          request.tenantId,
          request.userId ?? null,
          request.channel,
          request.templateKey,
          request.recipient ?? null,
          JSON.stringify(request.payload),
          request.availableAt ?? new Date(),
        ],
      );
      const id = result.rows[0]?.id;
      if (!id) throw new Error('Failed to enqueue notification');
      return id;
    });
  }
}

export class PostgresFileMetadataRepository implements FileMetadataRepository {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey: string,
  ) {}

  async create(record: Omit<FileMetadataRecord, 'id'>): Promise<FileMetadataRecord> {
    return withTenantContext(this.pool, this.tenantContextKey, record.tenantId, async (client) => {
      const result = await client.query<{
        id: string;
        tenant_id: string;
        owner_user_id: string | null;
        storage_key: string;
        original_name: string;
        content_type: string;
        size_bytes: string;
        checksum_sha256: string | null;
        metadata: FileMetadataRecord['metadata'];
      }>(
        `INSERT INTO stored_files (
           tenant_id, owner_user_id, storage_key, original_name, content_type,
           size_bytes, checksum_sha256, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING id, tenant_id, owner_user_id, storage_key, original_name,
                   content_type, size_bytes, checksum_sha256, metadata`,
        [
          record.tenantId,
          record.ownerUserId ?? null,
          record.storageKey,
          record.originalName,
          record.contentType,
          record.sizeBytes,
          record.checksumSha256 ?? null,
          JSON.stringify(record.metadata ?? {}),
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Failed to create file metadata');
      return {
        id: row.id,
        tenantId: row.tenant_id,
        ownerUserId: row.owner_user_id,
        storageKey: row.storage_key,
        originalName: row.original_name,
        contentType: row.content_type,
        sizeBytes: Number(row.size_bytes),
        checksumSha256: row.checksum_sha256,
        metadata: row.metadata ?? {},
      };
    });
  }

  async getById(tenantId: string, fileId: string): Promise<FileMetadataRecord | null> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query<{
        id: string;
        tenant_id: string;
        owner_user_id: string | null;
        storage_key: string;
        original_name: string;
        content_type: string;
        size_bytes: string;
        checksum_sha256: string | null;
        metadata: FileMetadataRecord['metadata'];
      }>(
        `SELECT id, tenant_id, owner_user_id, storage_key, original_name,
                content_type, size_bytes, checksum_sha256, metadata
         FROM stored_files
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [tenantId, fileId],
      );
      const row = result.rows[0];
      return row
        ? {
            id: row.id,
            tenantId: row.tenant_id,
            ownerUserId: row.owner_user_id,
            storageKey: row.storage_key,
            originalName: row.original_name,
            contentType: row.content_type,
            sizeBytes: Number(row.size_bytes),
            checksumSha256: row.checksum_sha256,
            metadata: row.metadata ?? {},
          }
        : null;
    });
  }

  async softDelete(tenantId: string, fileId: string, deletedAt: Date): Promise<boolean> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE stored_files
         SET deleted_at = $3
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, fileId, deletedAt],
      );
      return (result.rowCount ?? 0) === 1;
    });
  }
}

export class PostgresSchedulerService implements SchedulerServicePort {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey: string,
  ) {}

  async schedule(request: ScheduledJobRequest): Promise<string> {
    return withTenantContext(this.pool, this.tenantContextKey, request.tenantId, async (client) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO scheduled_jobs (
           tenant_id, job_type, payload, schedule_kind, cron_expression,
           timezone, next_run_at, max_attempts
         ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          request.tenantId,
          request.jobType,
          JSON.stringify(request.payload),
          request.scheduleKind,
          request.cronExpression ?? null,
          request.timezone ?? 'UTC',
          request.nextRunAt,
          request.maxAttempts ?? 5,
        ],
      );
      const id = result.rows[0]?.id;
      if (!id) throw new Error('Failed to schedule job');
      return id;
    });
  }

  async cancel(tenantId: string, jobId: string): Promise<boolean> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE scheduled_jobs
         SET status = 'cancelled', updated_at = NOW(), lease_owner = NULL, lease_expires_at = NULL
         WHERE tenant_id = $1 AND id = $2 AND status IN ('scheduled', 'failed')`,
        [tenantId, jobId],
      );
      return (result.rowCount ?? 0) === 1;
    });
  }
}

/**
 * Transactional outbox publisher. A domain event is intentionally rejected
 * outside an active UnitOfWork transaction so business state and the outbox
 * record cannot commit independently.
 */
export class PostgresOutboxPublisher implements DomainEventPublisher {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey: string,
  ) {}

  async publish(event: DomainEvent): Promise<string> {
    if (!getTransactionContext()) {
      throw new Error('Domain events must be published inside an active transaction');
    }

    return withTenantContext(this.pool, this.tenantContextKey, event.tenantId, async (client) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO outbox_events (
           tenant_id, aggregate_type, aggregate_id, event_name, event_version,
           payload, correlation_id, occurred_at
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
         RETURNING id`,
        [
          event.tenantId,
          event.aggregateType,
          event.aggregateId,
          event.eventName,
          event.eventVersion,
          JSON.stringify(event.payload),
          event.correlationId ?? null,
          event.occurredAt ?? new Date(),
        ],
      );
      const id = result.rows[0]?.id;
      if (!id) throw new Error('Failed to append outbox event');
      return id;
    });
  }
}

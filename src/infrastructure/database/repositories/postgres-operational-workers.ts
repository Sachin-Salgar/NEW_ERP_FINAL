import type { Pool } from 'pg';

import type {
  ClaimedOutboxEvent,
  ClaimedScheduledJob,
  OutboxStore,
  ScheduledJobStore,
} from '../../../application/contracts/operational-workers.js';
import { withTenantContext } from '../tenant-context.js';

export class PostgresScheduledJobStore implements ScheduledJobStore {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey: string,
  ) {}

  async claimDue(tenantId: string, workerId: string, leaseSeconds = 60): Promise<ClaimedScheduledJob | null> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query<{
        id: string;
        tenant_id: string;
        job_type: string;
        payload: ClaimedScheduledJob['payload'];
        schedule_kind: 'once' | 'recurring';
        cron_expression: string | null;
        timezone: string;
        attempt_count: number;
        max_attempts: number;
      }>(
        `WITH candidate AS (
           SELECT id
           FROM scheduled_jobs
           WHERE tenant_id = $1
             AND status IN ('scheduled', 'failed')
             AND next_run_at <= NOW()
             AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
             AND attempt_count < max_attempts
           ORDER BY next_run_at, created_at
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE scheduled_jobs j
         SET status = 'running',
             lease_owner = $2,
             lease_expires_at = NOW() + ($3 * INTERVAL '1 second'),
             attempt_count = attempt_count + 1,
             updated_at = NOW()
         FROM candidate
         WHERE j.id = candidate.id
         RETURNING j.id, j.tenant_id, j.job_type, j.payload, j.schedule_kind,
                   j.cron_expression, j.timezone, j.attempt_count, j.max_attempts`,
        [tenantId, workerId, leaseSeconds],
      );
      const row = result.rows[0];
      return row
        ? {
            id: row.id,
            tenantId: row.tenant_id,
            jobType: row.job_type,
            payload: row.payload,
            scheduleKind: row.schedule_kind,
            cronExpression: row.cron_expression,
            timezone: row.timezone,
            attemptCount: row.attempt_count,
            maxAttempts: row.max_attempts,
          }
        : null;
    });
  }

  async complete(tenantId: string, jobId: string, nextRunAt?: Date | null): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      await client.query(
        `UPDATE scheduled_jobs
         SET status = CASE WHEN schedule_kind = 'recurring' AND $3::timestamptz IS NOT NULL THEN 'scheduled' ELSE 'completed' END,
             next_run_at = COALESCE($3, next_run_at),
             lease_owner = NULL,
             lease_expires_at = NULL,
             last_error = NULL,
             updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND status = 'running'`,
        [tenantId, jobId, nextRunAt ?? null],
      );
    });
  }

  async fail(tenantId: string, jobId: string, errorCode: string, retryAt?: Date | null): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      await client.query(
        `UPDATE scheduled_jobs
         SET status = CASE WHEN attempt_count >= max_attempts THEN 'failed' ELSE 'scheduled' END,
             next_run_at = COALESCE($4, next_run_at),
             lease_owner = NULL,
             lease_expires_at = NULL,
             last_error = $3,
             updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, jobId, errorCode.slice(0, 1000), retryAt ?? null],
      );
    });
  }
}

export class PostgresOutboxStore implements OutboxStore {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey: string,
  ) {}

  async claimPending(tenantId: string, batchSize = 50): Promise<ClaimedOutboxEvent[]> {
    const safeBatchSize = Math.max(1, Math.min(batchSize, 200));
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query<{
        id: string;
        tenant_id: string;
        aggregate_type: string;
        aggregate_id: string;
        event_name: string;
        event_version: number;
        payload: ClaimedOutboxEvent['payload'];
        correlation_id: string | null;
      }>(
        `SELECT id, tenant_id, aggregate_type, aggregate_id, event_name,
                event_version, payload, correlation_id
         FROM outbox_events
         WHERE tenant_id = $1
           AND published_at IS NULL
           AND available_at <= NOW()
         ORDER BY occurred_at, id
         FOR UPDATE SKIP LOCKED
         LIMIT $2`,
        [tenantId, safeBatchSize],
      );
      return result.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        eventName: row.event_name,
        eventVersion: row.event_version,
        payload: row.payload,
        correlationId: row.correlation_id,
      }));
    });
  }

  async markPublished(tenantId: string, eventId: string, publishedAt = new Date()): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      await client.query(
        `UPDATE outbox_events
         SET published_at = $3, last_error = NULL
         WHERE tenant_id = $1 AND id = $2 AND published_at IS NULL`,
        [tenantId, eventId, publishedAt],
      );
    });
  }

  async markFailed(tenantId: string, eventId: string, errorCode: string, retryAt: Date): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      await client.query(
        `UPDATE outbox_events
         SET attempt_count = attempt_count + 1,
             last_error = $3,
             available_at = $4
         WHERE tenant_id = $1 AND id = $2 AND published_at IS NULL`,
        [tenantId, eventId, errorCode.slice(0, 1000), retryAt],
      );
    });
  }
}

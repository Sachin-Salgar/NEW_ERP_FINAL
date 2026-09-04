import type { Pool } from 'pg';

import type {
  ClaimedNotification,
  NotificationDeliveryStore,
} from '../../../application/contracts/notification-delivery.js';
import { withTenantContext } from '../tenant-context.js';

export class PostgresNotificationDeliveryStore implements NotificationDeliveryStore {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey: string,
  ) {}

  async claimNext(tenantId: string, workerId: string, leaseSeconds = 60): Promise<ClaimedNotification | null> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query<{
        id: string;
        tenant_id: string;
        user_id: string | null;
        channel: 'email' | 'in_app';
        template_key: string;
        recipient: string | null;
        payload: ClaimedNotification['payload'];
        attempt_count: number;
        max_attempts: number;
      }>(
        `WITH candidate AS (
           SELECT id
           FROM notifications
           WHERE tenant_id = $1
             AND status IN ('pending', 'failed')
             AND available_at <= NOW()
             AND attempt_count < max_attempts
             AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
           ORDER BY available_at, created_at
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE notifications n
         SET status = 'processing',
             lease_owner = $2,
             lease_expires_at = NOW() + ($3 * INTERVAL '1 second'),
             attempt_count = attempt_count + 1
         FROM candidate
         WHERE n.id = candidate.id
         RETURNING n.id, n.tenant_id, n.user_id, n.channel, n.template_key,
                   n.recipient, n.payload, n.attempt_count, n.max_attempts`,
        [tenantId, workerId, leaseSeconds],
      );
      const row = result.rows[0];
      return row
        ? {
            id: row.id,
            tenantId: row.tenant_id,
            userId: row.user_id,
            channel: row.channel,
            templateKey: row.template_key,
            recipient: row.recipient,
            payload: row.payload,
            attemptCount: row.attempt_count,
            maxAttempts: row.max_attempts,
          }
        : null;
    });
  }

  async markSent(tenantId: string, notificationId: string, workerId: string, provider?: string | null): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query<{ attempt_count: number }>(
        `UPDATE notifications
         SET status = 'sent', sent_at = NOW(), failed_at = NULL,
             lease_owner = NULL, lease_expires_at = NULL, last_error = NULL
         WHERE tenant_id = $1 AND id = $2 AND lease_owner = $3 AND status = 'processing'
         RETURNING attempt_count`,
        [tenantId, notificationId, workerId],
      );
      const attempt = result.rows[0]?.attempt_count;
      if (attempt === undefined) return;
      await client.query(
        `INSERT INTO notification_delivery_attempts (
           tenant_id, notification_id, attempt_no, provider, outcome
         ) VALUES ($1, $2, $3, $4, 'sent')`,
        [tenantId, notificationId, attempt, provider ?? null],
      );
    });
  }

  async markFailed(
    tenantId: string,
    notificationId: string,
    workerId: string,
    errorCode: string,
    retryAt?: Date | null,
    provider?: string | null,
  ): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query<{ attempt_count: number; max_attempts: number }>(
        `UPDATE notifications
         SET status = 'failed',
             failed_at = NOW(),
             available_at = COALESCE($5, available_at),
             lease_owner = NULL,
             lease_expires_at = NULL,
             last_error = $4
         WHERE tenant_id = $1 AND id = $2 AND lease_owner = $3 AND status = 'processing'
         RETURNING attempt_count, max_attempts`,
        [tenantId, notificationId, workerId, errorCode.slice(0, 1000), retryAt ?? null],
      );
      const row = result.rows[0];
      if (!row) return;
      await client.query(
        `INSERT INTO notification_delivery_attempts (
           tenant_id, notification_id, attempt_no, provider, outcome, error_code
         ) VALUES ($1, $2, $3, $4, 'failed', $5)`,
        [tenantId, notificationId, row.attempt_count, provider ?? null, errorCode.slice(0, 160)],
      );
    });
  }
}

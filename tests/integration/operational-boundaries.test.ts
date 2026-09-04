import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import {
  PostgresOutboxStore,
  PostgresScheduledJobStore,
} from '../../src/infrastructure/database/repositories/postgres-operational-workers.js';
import { PostgresNotificationDeliveryStore } from '../../src/infrastructure/database/repositories/postgres-notification-delivery-store.js';
import {
  PostgresNotificationService,
  PostgresOutboxPublisher,
  PostgresSchedulerService,
} from '../../src/infrastructure/database/repositories/postgres-operational-services.js';
import { UnitOfWork } from '../../src/infrastructure/database/unit-of-work.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { resolveDatabaseUrl } from '../../src/config/schema.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const tenantContextKey = 'app.current_tenant_id';

describe('operational worker and outbox database boundaries', () => {
  let pool: Pool | undefined;

  afterAll(async () => {
    await pool?.end();
  });

  it('enforces application-role worker isolation and proves transactional outbox behavior', async () => {
    if (!databaseUrl) return;
    pool = new Pool({ connectionString: databaseUrl });

    const platform = new PostgresPlatformRepository(pool);
    const tenants = new TenantBootstrapService(platform, new BcryptPasswordHasher());
    const suffix = `${Date.now()}`;
    const seed = (name: string) => ({
      tenant: {
        name: `${name} ${suffix}`,
        displayName: `${name} ${suffix}`,
        subdomain: `${name.toLowerCase()}-${suffix}`,
        slug: `${name.toLowerCase()}-${suffix}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: { code: `${name.slice(0, 3)}${suffix}`, name: `${name} Org` },
      branch: { code: `${name.slice(0, 3)}${suffix}`, name: `${name} Branch` },
      administrator: {
        username: `${name.toLowerCase()}-${suffix}`,
        email: `${name.toLowerCase()}-${suffix}@example.com`,
        password: 'Password123!',
      },
      role: { code: `${name.toLowerCase()}-${suffix}`, name: `${name} Admin` },
      permissions: ['user.manage'],
    });
    const tenantA = await tenants.bootstrapTenant(seed('WorkerA'));
    const tenantB = await tenants.bootstrapTenant(seed('WorkerB'));

    const scheduler = new PostgresSchedulerService(pool, tenantContextKey);
    const notifications = new PostgresNotificationService(pool, tenantContextKey);
    const jobs = new PostgresScheduledJobStore(pool, tenantContextKey);
    const deliveries = new PostgresNotificationDeliveryStore(pool, tenantContextKey);
    const outbox = new PostgresOutboxStore(pool, tenantContextKey);

    const jobId = await scheduler.schedule({
      tenantId: tenantA.tenantId,
      jobType: 'worker.test',
      payload: { tenant: tenantA.tenantId },
      scheduleKind: 'once',
      nextRunAt: new Date(Date.now() - 1000),
    });
    const notificationId = await notifications.enqueue({
      tenantId: tenantA.tenantId,
      channel: 'email',
      templateKey: 'worker.test',
      recipient: 'worker@example.com',
      payload: { tenant: tenantA.tenantId },
    });

    const wrongTenantJob = await jobs.claimDue(tenantB.tenantId, 'worker-b');
    const wrongTenantNotification = await deliveries.claimNext(tenantB.tenantId, 'worker-b');
    expect(wrongTenantJob).toBeNull();
    expect(wrongTenantNotification).toBeNull();
    await jobs.complete(tenantB.tenantId, jobId);
    await deliveries.markSent(tenantB.tenantId, notificationId, 'worker-b');

    const uow = new UnitOfWork(pool);
    const publisher = new PostgresOutboxPublisher(pool, tenantContextKey);
    let rolledBackEventId: string | undefined;
    await expect(
      uow.runInTransaction(async () => {
        await withTenantContext(pool!, tenantContextKey, tenantA.tenantId, async (client) => {
          await client.query(`UPDATE notifications SET last_error = $2 WHERE tenant_id = $1 AND id = $3`, [
            tenantA.tenantId,
            'transactional-business-mutation',
            notificationId,
          ]);
        });
        rolledBackEventId = await publisher.publish({
          tenantId: tenantA.tenantId,
          aggregateType: 'notification',
          aggregateId: notificationId,
          eventName: 'worker.test',
          eventVersion: 1,
          payload: { notificationId },
        });
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    const rolledBack = await withTenantContext(pool, tenantContextKey, tenantA.tenantId, (client) =>
      client.query(
        `SELECT
           (SELECT COUNT(*)::int FROM outbox_events WHERE id = $1) AS events,
           (SELECT last_error FROM notifications WHERE id = $2) AS last_error`,
        [rolledBackEventId, notificationId],
      ),
    );
    expect(rolledBack.rows[0]).toEqual({ events: 0, last_error: null });

    let committedEventId: string | undefined;
    await uow.runInTransaction(async () => {
      await withTenantContext(pool!, tenantContextKey, tenantA.tenantId, async (client) => {
        await client.query(`UPDATE notifications SET last_error = $2 WHERE tenant_id = $1 AND id = $3`, [
          tenantA.tenantId,
          'committed-business-mutation',
          notificationId,
        ]);
      });
      committedEventId = await publisher.publish({
        tenantId: tenantA.tenantId,
        aggregateType: 'notification',
        aggregateId: notificationId,
        eventName: 'worker.test',
        eventVersion: 1,
        payload: { notificationId },
      });
    });

    const committed = await withTenantContext(pool, tenantContextKey, tenantA.tenantId, (client) =>
      client.query(
        `SELECT e.tenant_id, e.id, n.last_error
         FROM outbox_events e
         JOIN notifications n ON n.id = e.aggregate_id::uuid
         WHERE e.id = $1`,
        [committedEventId],
      ),
    );
    expect(committed.rows[0]).toEqual({
      tenant_id: tenantA.tenantId,
      id: committedEventId,
      last_error: 'committed-business-mutation',
    });

    const firstClaim = await outbox.claimPending(tenantA.tenantId, 'worker-a', 1);
    expect(firstClaim).toHaveLength(1);
    expect(firstClaim[0]?.id).toBe(committedEventId);
    await outbox.markFailed(tenantA.tenantId, committedEventId!, 'worker-a', 'temporary', new Date(Date.now() - 1));
    const retryClaim = await outbox.claimPending(tenantA.tenantId, 'worker-a-retry', 1);
    expect(retryClaim[0]?.id).toBe(committedEventId);
    expect(retryClaim[0]?.tenantId).toBe(tenantA.tenantId);

    const role = await pool.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `SELECT r.rolsuper, r.rolbypassrls
       FROM pg_roles r
       WHERE r.rolname = current_user`,
    );
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });

    const forceRls = await pool.query<{ relforcerowsecurity: boolean }>(
      `SELECT relforcerowsecurity
       FROM pg_class
       WHERE oid IN ('scheduled_jobs'::regclass, 'notifications'::regclass, 'outbox_events'::regclass)
       ORDER BY oid::text`,
    );
    expect(forceRls.rows).toHaveLength(3);
    expect(forceRls.rows.every((row) => row.relforcerowsecurity)).toBe(true);
  });
});

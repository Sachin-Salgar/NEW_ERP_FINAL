import { describe, expect, it, vi } from 'vitest';

import { NotificationDeliveryWorker } from '../../src/application/services/notification-delivery-worker.js';
import { SchedulerWorker } from '../../src/application/services/scheduler-worker.js';
import type { NotificationDeliveryStore } from '../../src/application/contracts/notification-delivery.js';
import { trustedWorkerScope, type ScheduledJobStore } from '../../src/application/contracts/operational-workers.js';

const tenantId = '11111111-1111-4111-8111-111111111111';

describe('tenant-scoped workers', () => {
  it('uses the supplied tenant only for claim and acknowledgement', async () => {
    const store: ScheduledJobStore = {
      claimDue: vi.fn(async (requestedTenant) => ({
        id: 'job-1',
        tenantId: requestedTenant,
        jobType: 'test',
        payload: {},
        scheduleKind: 'once' as const,
        timezone: 'UTC',
        attemptCount: 1,
        maxAttempts: 3,
      })),
      complete: vi.fn(async () => undefined),
      fail: vi.fn(async () => undefined),
    };
    const worker = new SchedulerWorker(store, [{ jobType: 'test', execute: vi.fn(async () => undefined) }], {
      nextRun: () => new Date(),
    });

    await expect(worker.runNext(trustedWorkerScope(tenantId), 'worker-a')).resolves.toBe(true);
    expect(store.claimDue).toHaveBeenCalledWith(tenantId, 'worker-a', 60);
    expect(store.complete).toHaveBeenCalledWith(tenantId, 'job-1', null);
  });

  it('fails notification work under the claimed tenant and worker lease', async () => {
    const store: NotificationDeliveryStore = {
      claimNext: vi.fn(async () => ({
        id: 'notification-1',
        tenantId,
        channel: 'email' as const,
        templateKey: 'test',
        payload: {},
        attemptCount: 1,
        maxAttempts: 2,
      })),
      markSent: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const worker = new NotificationDeliveryWorker(
      store,
      [
        {
          channel: 'email',
          providerName: 'test',
          deliver: vi.fn(async () => {
            throw new Error('failed');
          }),
        },
      ],
      { render: vi.fn(async (input) => input.payload) },
    );

    await expect(worker.runNext(trustedWorkerScope(tenantId), 'worker-a')).resolves.toBe(true);
    expect(store.markFailed).toHaveBeenCalledWith(
      tenantId,
      'notification-1',
      'worker-a',
      'Error',
      expect.any(Date),
      'test',
    );
  });
});

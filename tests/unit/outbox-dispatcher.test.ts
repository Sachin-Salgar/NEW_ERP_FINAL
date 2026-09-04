import { describe, expect, it, vi } from 'vitest';

import { OutboxDispatcher } from '../../src/application/services/outbox-dispatcher.js';
import { trustedWorkerScope } from '../../src/application/contracts/operational-workers.js';
import type { ClaimedOutboxEvent, OutboxStore } from '../../src/application/contracts/operational-workers.js';

const event: ClaimedOutboxEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  aggregateType: 'order',
  aggregateId: '33333333-3333-4333-8333-333333333333',
  eventName: 'order.created',
  eventVersion: 1,
  payload: { orderId: '33333333-3333-4333-8333-333333333333' },
  correlationId: 'corr-1',
};

function store(): OutboxStore {
  return {
    claimPending: vi.fn(async () => [event]),
    markPublished: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
  };
}

describe('OutboxDispatcher', () => {
  it('marks a delivered event only after transport success', async () => {
    const outbox = store();
    const transport = { transportName: 'test', deliver: vi.fn(async () => undefined) };

    await expect(
      new OutboxDispatcher(outbox, transport).dispatchBatch(trustedWorkerScope(event.tenantId), 'worker-a'),
    ).resolves.toBe(1);

    expect(outbox.markPublished).toHaveBeenCalledWith(event.tenantId, event.id, 'worker-a');
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it('releases a failed delivery for a later attempt without marking it published', async () => {
    const outbox = store();
    const transport = {
      transportName: 'test',
      deliver: vi.fn(async () => {
        throw new Error('transport_failed');
      }),
    };

    await expect(
      new OutboxDispatcher(outbox, transport, { retryBaseSeconds: 1 }).dispatchBatch(
        trustedWorkerScope(event.tenantId),
        'worker-a',
      ),
    ).resolves.toBe(1);

    expect(outbox.markPublished).not.toHaveBeenCalled();
    expect(outbox.markFailed).toHaveBeenCalledWith(event.tenantId, event.id, 'worker-a', 'Error', expect.any(Date));
  });

  it('preserves stable event identity for duplicate delivery attempts', async () => {
    const outbox = store();
    const transport = {
      transportName: 'idempotent-test',
      deliver: vi.fn(async (_event: ClaimedOutboxEvent) => undefined),
    };
    const dispatcher = new OutboxDispatcher(outbox, transport);

    await dispatcher.dispatchBatch(trustedWorkerScope(event.tenantId), 'worker-a');
    await dispatcher.dispatchBatch(trustedWorkerScope(event.tenantId), 'worker-b');

    expect(transport.deliver).toHaveBeenCalledWith(expect.objectContaining({ id: event.id }));
    expect(transport.deliver.mock.calls[0]?.[0].id).toBe(transport.deliver.mock.calls[1]?.[0].id);
  });
});

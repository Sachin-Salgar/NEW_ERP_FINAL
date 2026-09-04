import type { ClaimedOutboxEvent, OutboxStore } from '../contracts/operational-workers.js';

export interface ExternalEventTransport {
  readonly transportName: string;
  deliver(event: ClaimedOutboxEvent): Promise<void>;
}

export class OutboxDispatcher {
  constructor(
    private readonly store: OutboxStore,
    private readonly transport: ExternalEventTransport,
    private readonly options: {
      batchSize?: number;
      leaseSeconds?: number;
      retryBaseSeconds?: number;
    } = {},
  ) {}

  async dispatchBatch(tenantId: string, workerId: string): Promise<number> {
    const events = await this.store.claimPending(
      tenantId,
      workerId,
      this.options.batchSize ?? 50,
      this.options.leaseSeconds ?? 60,
    );

    let processed = 0;
    for (const event of events) {
      try {
        await this.transport.deliver(event);
        await this.store.markPublished(tenantId, event.id, workerId);
      } catch (error) {
        const errorCode = error instanceof Error ? error.name || 'outbox_delivery_failed' : 'outbox_delivery_failed';
        await this.store.markFailed(tenantId, event.id, workerId, errorCode, this.retryAt(event.id));
      }
      processed += 1;
    }

    return processed;
  }

  private retryAt(eventId: string): Date {
    const baseSeconds = Math.max(1, this.options.retryBaseSeconds ?? 30);
    // Stable bounded jitter prevents synchronized retries without relying on a
    // process-global random source that would make tests nondeterministic.
    const suffix = eventId.replace(/-/g, '').slice(-2);
    const jitterSeconds = Number.parseInt(suffix, 16) % Math.max(1, baseSeconds);
    return new Date(Date.now() + (baseSeconds + jitterSeconds) * 1000);
  }
}

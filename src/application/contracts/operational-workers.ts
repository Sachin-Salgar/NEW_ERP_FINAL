import type { StructuredPayload } from './operational-services.js';

export interface ClaimedScheduledJob {
  id: string;
  tenantId: string;
  jobType: string;
  payload: StructuredPayload;
  scheduleKind: 'once' | 'recurring';
  cronExpression?: string | null;
  timezone: string;
  attemptCount: number;
  maxAttempts: number;
}

export interface ScheduledJobStore {
  claimDue(tenantId: string, workerId: string, leaseSeconds?: number): Promise<ClaimedScheduledJob | null>;
  complete(tenantId: string, jobId: string, nextRunAt?: Date | null): Promise<void>;
  fail(tenantId: string, jobId: string, errorCode: string, retryAt?: Date | null): Promise<void>;
}

export interface TrustedWorkerScope {
  readonly tenantId: string;
  readonly source: 'persisted-work';
}

export function trustedWorkerScope(tenantId: string): TrustedWorkerScope {
  return Object.freeze({ tenantId, source: 'persisted-work' as const });
}

export interface ClaimedOutboxEvent {
  id: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  eventName: string;
  eventVersion: number;
  payload: StructuredPayload;
  correlationId?: string | null;
}

export interface OutboxStore {
  claimPending(
    tenantId: string,
    workerId: string,
    batchSize?: number,
    leaseSeconds?: number,
  ): Promise<ClaimedOutboxEvent[]>;
  markPublished(tenantId: string, eventId: string, workerId: string, publishedAt?: Date): Promise<void>;
  markFailed(tenantId: string, eventId: string, workerId: string, errorCode: string, retryAt: Date): Promise<void>;
}

import type { ClaimedScheduledJob, ScheduledJobStore, TrustedWorkerScope } from '../contracts/operational-workers.js';

export interface ScheduledJobHandler {
  readonly jobType: string;
  execute(job: ClaimedScheduledJob): Promise<void>;
}

export interface RecurringScheduleCalculator {
  nextRun(input: { cronExpression: string; timezone: string; after: Date }): Date;
}

export class SchedulerWorker {
  private readonly handlers: Map<string, ScheduledJobHandler>;

  constructor(
    private readonly store: ScheduledJobStore,
    handlers: readonly ScheduledJobHandler[],
    private readonly recurringScheduleCalculator: RecurringScheduleCalculator,
    private readonly options: { leaseSeconds?: number; retryBaseSeconds?: number } = {},
  ) {
    this.handlers = new Map(handlers.map((handler) => [handler.jobType, handler]));
  }

  async runNext(scope: TrustedWorkerScope, workerId: string): Promise<boolean> {
    const tenantId = scope.tenantId;
    const job = await this.store.claimDue(tenantId, workerId, this.options.leaseSeconds ?? 60);
    if (!job) return false;

    const handler = this.handlers.get(job.jobType);
    if (!handler) {
      await this.store.fail(tenantId, job.id, 'scheduled_job_handler_unavailable', this.retryAt(job.attemptCount));
      return true;
    }

    try {
      await handler.execute(job);
      const nextRunAt = this.calculateNextRun(job);
      await this.store.complete(tenantId, job.id, nextRunAt);
    } catch (error) {
      const errorCode = error instanceof Error ? error.name || 'scheduled_job_failed' : 'scheduled_job_failed';
      await this.store.fail(
        tenantId,
        job.id,
        errorCode,
        job.attemptCount >= job.maxAttempts ? null : this.retryAt(job.attemptCount),
      );
    }

    return true;
  }

  private calculateNextRun(job: ClaimedScheduledJob): Date | null {
    if (job.scheduleKind !== 'recurring') return null;
    if (!job.cronExpression) throw new Error('Recurring scheduled job requires a cron expression');
    return this.recurringScheduleCalculator.nextRun({
      cronExpression: job.cronExpression,
      timezone: job.timezone,
      after: new Date(),
    });
  }

  private retryAt(attemptCount: number): Date {
    const baseSeconds = Math.max(1, this.options.retryBaseSeconds ?? 30);
    return new Date(Date.now() + baseSeconds * 2 ** Math.min(Math.max(attemptCount - 1, 0), 8) * 1000);
  }
}

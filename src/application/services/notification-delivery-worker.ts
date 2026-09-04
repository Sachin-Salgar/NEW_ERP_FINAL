import type {
  NotificationChannelProvider,
  NotificationDeliveryStore,
  NotificationTemplateRenderer,
} from '../contracts/notification-delivery.js';
import type { TrustedWorkerScope } from '../contracts/operational-workers.js';

export class NotificationDeliveryWorker {
  private readonly providers: Map<string, NotificationChannelProvider>;

  constructor(
    private readonly store: NotificationDeliveryStore,
    providers: readonly NotificationChannelProvider[],
    private readonly renderer: NotificationTemplateRenderer,
    private readonly options: { retryBaseSeconds?: number; leaseSeconds?: number } = {},
  ) {
    this.providers = new Map(providers.map((provider) => [provider.channel, provider]));
  }

  async runNext(scope: TrustedWorkerScope, workerId: string): Promise<boolean> {
    const tenantId = scope.tenantId;
    const notification = await this.store.claimNext(tenantId, workerId, this.options.leaseSeconds ?? 60);
    if (!notification) return false;

    const provider = this.providers.get(notification.channel);
    if (!provider) {
      await this.store.markFailed(
        tenantId,
        notification.id,
        workerId,
        'notification_provider_unavailable',
        this.retryAt(notification.attemptCount),
        null,
      );
      return true;
    }

    try {
      notification.payload = await this.renderer.render({
        templateKey: notification.templateKey,
        channel: notification.channel,
        payload: notification.payload,
      });
      await provider.deliver(notification);
      await this.store.markSent(tenantId, notification.id, workerId, provider.providerName);
    } catch (error) {
      const errorCode =
        error instanceof Error ? error.name || 'notification_delivery_failed' : 'notification_delivery_failed';
      await this.store.markFailed(
        tenantId,
        notification.id,
        workerId,
        errorCode,
        notification.attemptCount >= notification.maxAttempts ? null : this.retryAt(notification.attemptCount),
        provider.providerName,
      );
    }

    return true;
  }

  private retryAt(attemptCount: number): Date {
    const baseSeconds = Math.max(1, this.options.retryBaseSeconds ?? 30);
    const boundedExponent = Math.min(Math.max(attemptCount - 1, 0), 8);
    return new Date(Date.now() + baseSeconds * 2 ** boundedExponent * 1000);
  }
}

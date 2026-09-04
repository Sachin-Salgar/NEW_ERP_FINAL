import type { NotificationChannel, StructuredPayload } from './operational-services.js';

export interface ClaimedNotification {
  id: string;
  tenantId: string;
  userId?: string | null;
  channel: NotificationChannel;
  templateKey: string;
  recipient?: string | null;
  payload: StructuredPayload;
  attemptCount: number;
  maxAttempts: number;
}

export interface NotificationDeliveryStore {
  claimNext(tenantId: string, workerId: string, leaseSeconds?: number): Promise<ClaimedNotification | null>;
  markSent(tenantId: string, notificationId: string, workerId: string, provider?: string | null): Promise<void>;
  markFailed(
    tenantId: string,
    notificationId: string,
    workerId: string,
    errorCode: string,
    retryAt?: Date | null,
    provider?: string | null,
  ): Promise<void>;
}

export interface NotificationChannelProvider {
  readonly channel: NotificationChannel;
  readonly providerName: string;
  deliver(notification: ClaimedNotification): Promise<void>;
}

export interface NotificationTemplateRenderer {
  render(input: {
    templateKey: string;
    channel: NotificationChannel;
    payload: StructuredPayload;
  }): Promise<StructuredPayload>;
}

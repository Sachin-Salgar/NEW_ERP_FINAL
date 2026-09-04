import type { AccountSecurityNotificationPort } from '../contracts/account-security.js';
import type { NotificationServicePort } from '../contracts/operational-services.js';

/** Routes account-security messages through the platform notification queue. */
export class AccountSecurityNotificationAdapter implements AccountSecurityNotificationPort {
  constructor(private readonly notifications: NotificationServicePort) {}

  async sendEmailVerification(input: {
    tenantId: string;
    userId: string;
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.notifications.enqueue({
      tenantId: input.tenantId,
      userId: input.userId,
      channel: 'email',
      templateKey: 'auth.email-verification',
      recipient: input.email,
      payload: {
        token: input.token,
        expiresAt: input.expiresAt.toISOString(),
      },
    });
  }

  async sendPasswordReset(input: {
    tenantId: string;
    userId: string;
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.notifications.enqueue({
      tenantId: input.tenantId,
      userId: input.userId,
      channel: 'email',
      templateKey: 'auth.password-reset',
      recipient: input.email,
      payload: {
        token: input.token,
        expiresAt: input.expiresAt.toISOString(),
      },
    });
  }
}

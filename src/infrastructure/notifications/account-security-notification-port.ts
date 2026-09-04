import type { AccountSecurityNotificationPort } from '../../application/contracts/account-security.js';
import type { NotificationServicePort } from '../../application/contracts/operational-services.js';

/**
 * Bridges account-security lifecycle notifications into the provider-neutral
 * notification queue. Tokens are short-lived and intended only for the named
 * security template; concrete email delivery remains outside the application
 * layer.
 */
export class AccountSecurityNotificationPortAdapter implements AccountSecurityNotificationPort {
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

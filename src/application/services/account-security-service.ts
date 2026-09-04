import { createHash, randomBytes } from 'node:crypto';

import type {
  AccountSecurityNotificationPort,
  AccountSecurityRepository,
} from '../contracts/account-security.js';
import type { PasswordHasher } from '../contracts/security.js';

export interface AccountSecurityOptions {
  emailVerificationTtlMinutes?: number;
  passwordResetTtlMinutes?: number;
}

export class AccountSecurityService {
  private readonly emailVerificationTtlMinutes: number;
  private readonly passwordResetTtlMinutes: number;

  constructor(
    private readonly repository: AccountSecurityRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly notifications: AccountSecurityNotificationPort,
    options: AccountSecurityOptions = {},
  ) {
    this.emailVerificationTtlMinutes = options.emailVerificationTtlMinutes ?? 60 * 24;
    this.passwordResetTtlMinutes = options.passwordResetTtlMinutes ?? 30;
  }

  async requestEmailVerification(tenantId: string, identifier: string): Promise<void> {
    const user = await this.repository.findUserByIdentifier(tenantId, identifier.trim());
    if (!user) return;

    const token = createOpaqueToken();
    const expiresAt = new Date(Date.now() + this.emailVerificationTtlMinutes * 60_000);
    await this.repository.createEmailVerificationToken({
      tenantId,
      userId: user.id,
      tokenHash: hashOpaqueToken(token),
      expiresAt,
    });
    await this.notifications.sendEmailVerification({
      tenantId,
      userId: user.id,
      email: user.email,
      token,
      expiresAt,
    });
  }

  async verifyEmail(tenantId: string, token: string): Promise<boolean> {
    return this.repository.consumeEmailVerificationToken(
      tenantId,
      hashOpaqueToken(token),
      new Date(),
    );
  }

  /**
   * Deliberately returns no account-existence signal. Callers should always use
   * the same generic response whether an account exists or not.
   */
  async requestPasswordReset(tenantId: string, identifier: string): Promise<void> {
    const user = await this.repository.findUserByIdentifier(tenantId, identifier.trim());
    if (!user) return;

    const token = createOpaqueToken();
    const expiresAt = new Date(Date.now() + this.passwordResetTtlMinutes * 60_000);
    await this.repository.createPasswordResetToken({
      tenantId,
      userId: user.id,
      tokenHash: hashOpaqueToken(token),
      expiresAt,
    });
    await this.notifications.sendPasswordReset({
      tenantId,
      userId: user.id,
      email: user.email,
      token,
      expiresAt,
    });
  }

  async resetPassword(tenantId: string, token: string, newPassword: string): Promise<boolean> {
    const passwordHash = await this.passwordHasher.hash(newPassword);
    return this.repository.consumePasswordResetToken(
      tenantId,
      hashOpaqueToken(token),
      passwordHash,
      new Date(),
    );
  }
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

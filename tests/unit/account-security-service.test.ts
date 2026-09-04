import { describe, expect, it, vi } from 'vitest';

import { AccountSecurityService } from '../../src/application/services/account-security-service.js';
import type { AccountSecurityRepository, AccountSecurityNotificationPort } from '../../src/application/contracts/account-security.js';
import type { PasswordHasher } from '../../src/application/contracts/security.js';

function makeRepository(): AccountSecurityRepository {
  return {
    findAccountCandidates: vi.fn(async () => [{ id: 'user-1', tenantId: 'tenant-1', email: 'user@example.com', status: 'active' }]),
    findUserByIdentifier: vi.fn(async () => ({ id: 'user-1', tenantId: 'tenant-1', email: 'user@example.com', status: 'active' })),
    createEmailVerificationToken: vi.fn(async () => undefined),
    consumeEmailVerificationToken: vi.fn(async () => true),
    createPasswordResetToken: vi.fn(async () => undefined),
    consumePasswordResetToken: vi.fn(async () => true),
  };
}

function makeNotifications(): AccountSecurityNotificationPort {
  return {
    sendEmailVerification: vi.fn(async () => undefined),
    sendPasswordReset: vi.fn(async () => undefined),
  };
}

function makeHasher(): PasswordHasher {
  return {
    hash: vi.fn(async (password: string) => `hash:${password}`),
    verify: vi.fn(async () => true),
  };
}

describe('AccountSecurityService', () => {
  it('creates a hashed email verification token and queues delivery without returning the token', async () => {
    const repository = makeRepository();
    const notifications = makeNotifications();
    const service = new AccountSecurityService(repository, makeHasher(), notifications);

    await service.requestEmailVerification('tenant-1', 'user@example.com');

    expect(repository.createEmailVerificationToken).toHaveBeenCalledTimes(1);
    const tokenRecord = vi.mocked(repository.createEmailVerificationToken).mock.calls[0]![0];
    expect(tokenRecord.tenantId).toBe('tenant-1');
    expect(tokenRecord.userId).toBe('user-1');
    expect(tokenRecord.tokenHash).not.toBe('user@example.com');
    expect(tokenRecord.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(notifications.sendEmailVerification).toHaveBeenCalledTimes(1);
  });

  it('keeps password recovery enumeration-resistant by using a silent success path for zero candidates', async () => {
    const repository = makeRepository();
    vi.mocked(repository.findAccountCandidates).mockResolvedValueOnce([]);
    const notifications = makeNotifications();
    const service = new AccountSecurityService(repository, makeHasher(), notifications);

    await expect(service.requestPasswordReset('missing@example.com')).resolves.toBeUndefined();
    expect(notifications.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('hashes the new password before atomically consuming the reset token', async () => {
    const repository = makeRepository();
    const hasher = makeHasher();
    const service = new AccountSecurityService(repository, hasher, makeNotifications());

    await expect(service.resetPassword('tenant-1', 'opaque-token', 'NewPassword123!')).resolves.toBe(true);
    expect(hasher.hash).toHaveBeenCalledWith('NewPassword123!');
    expect(repository.consumePasswordResetToken).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(String),
      'hash:NewPassword123!',
      expect.any(Date),
    );
  });
});

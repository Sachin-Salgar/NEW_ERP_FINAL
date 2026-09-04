import { describe, expect, it, vi } from 'vitest';

import { MfaService } from '../../src/application/services/mfa-service.js';
import type { MfaRepository, MfaSecretProtector, TotpProvider } from '../../src/application/contracts/mfa.js';

function makeRepository(): MfaRepository {
  return {
    createEnrollment: vi.fn(async () => undefined),
    getPendingEnrollment: vi.fn(async () => ({ encryptedSecret: 'encrypted-secret', expiresAt: new Date(Date.now() + 60_000) })),
    activateEnrollment: vi.fn(async () => undefined),
    getEnabledSecret: vi.fn(async () => 'encrypted-secret'),
    consumeRecoveryCode: vi.fn(async () => true),
    disableMfa: vi.fn(async () => undefined),
  };
}

function makeProtector(): MfaSecretProtector {
  return {
    encrypt: vi.fn((value: string) => `encrypted:${value}`),
    decrypt: vi.fn(() => 'JBSWY3DPEHPK3PXP'),
  };
}

function makeTotp(): TotpProvider {
  return {
    generateSecret: vi.fn(() => 'JBSWY3DPEHPK3PXP'),
    verify: vi.fn(() => true),
  };
}

describe('MfaService', () => {
  it('creates an enrollment secret and otpauth URI without persisting plaintext', async () => {
    const repository = makeRepository();
    const protector = makeProtector();
    const service = new MfaService(repository, makeTotp(), protector, { issuer: 'new-erp-final' });

    const result = await service.beginEnrollment('tenant-1', 'user-1', 'user@example.com');

    expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(result.otpauthUri).toContain('otpauth://totp/');
    expect(repository.createEnrollment).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'encrypted:JBSWY3DPEHPK3PXP',
      expect.any(Date),
    );
  });

  it('activates enrollment only after a valid TOTP code and returns recovery codes once', async () => {
    const repository = makeRepository();
    const totp = makeTotp();
    const service = new MfaService(repository, totp, makeProtector(), { issuer: 'new-erp-final', recoveryCodeCount: 3 });

    const recoveryCodes = await service.confirmEnrollment('tenant-1', 'user-1', '123456');

    expect(totp.verify).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP', '123456');
    expect(recoveryCodes).toHaveLength(3);
    expect(repository.activateEnrollment).toHaveBeenCalledTimes(1);
    const hashes = vi.mocked(repository.activateEnrollment).mock.calls[0]![3];
    expect(hashes).toHaveLength(3);
    expect(hashes.every((value) => /^[0-9a-f]{64}$/.test(value))).toBe(true);
  });

  it('supports one-time recovery-code verification and disablement', async () => {
    const repository = makeRepository();
    const service = new MfaService(repository, makeTotp(), makeProtector(), { issuer: 'new-erp-final' });

    await expect(service.verify('tenant-1', 'user-1', 'RECOVERY-CODE')).resolves.toBe(true);
    await service.disable('tenant-1', 'user-1');

    expect(repository.consumeRecoveryCode).toHaveBeenCalledWith('tenant-1', 'user-1', expect.any(String));
    expect(repository.disableMfa).toHaveBeenCalledWith('tenant-1', 'user-1');
  });
});

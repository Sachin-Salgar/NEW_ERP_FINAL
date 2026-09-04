import { createHash, randomBytes } from 'node:crypto';

import type { MfaRepository, MfaSecretProtector, TotpProvider } from '../contracts/mfa.js';

export interface MfaEnrollmentResult {
  secret: string;
  otpauthUri: string;
  expiresAt: Date;
}

export interface MfaOptions {
  issuer: string;
  enrollmentTtlMinutes?: number;
  recoveryCodeCount?: number;
}

export class MfaService {
  private readonly enrollmentTtlMinutes: number;
  private readonly recoveryCodeCount: number;

  constructor(
    private readonly repository: MfaRepository,
    private readonly totp: TotpProvider,
    private readonly protector: MfaSecretProtector,
    private readonly options: MfaOptions,
  ) {
    this.enrollmentTtlMinutes = options.enrollmentTtlMinutes ?? 10;
    this.recoveryCodeCount = options.recoveryCodeCount ?? 8;
  }

  async beginEnrollment(tenantId: string, userId: string, accountLabel: string): Promise<MfaEnrollmentResult> {
    const secret = this.totp.generateSecret();
    const expiresAt = new Date(Date.now() + this.enrollmentTtlMinutes * 60_000);
    await this.repository.createEnrollment(
      tenantId,
      userId,
      this.protector.encrypt(secret),
      expiresAt,
    );

    const label = encodeURIComponent(`${this.options.issuer}:${accountLabel}`);
    const issuer = encodeURIComponent(this.options.issuer);
    return {
      secret,
      expiresAt,
      otpauthUri: `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
    };
  }

  async confirmEnrollment(tenantId: string, userId: string, token: string): Promise<string[]> {
    const enrollment = await this.repository.getPendingEnrollment(tenantId, userId);
    if (!enrollment || enrollment.expiresAt.getTime() <= Date.now()) {
      throw new Error('MFA enrollment is missing or expired');
    }

    const secret = this.protector.decrypt(enrollment.encryptedSecret);
    if (!this.totp.verify(secret, token)) {
      throw new Error('Invalid MFA verification code');
    }

    const recoveryCodes = Array.from({ length: this.recoveryCodeCount }, () => createRecoveryCode());
    await this.repository.activateEnrollment(
      tenantId,
      userId,
      enrollment.encryptedSecret,
      recoveryCodes.map(hashRecoveryCode),
    );
    return recoveryCodes;
  }

  async verify(tenantId: string, userId: string, tokenOrRecoveryCode: string): Promise<boolean> {
    const encryptedSecret = await this.repository.getEnabledSecret(tenantId, userId);
    if (!encryptedSecret) return false;

    if (/^\d{6}$/.test(tokenOrRecoveryCode)) {
      const secret = this.protector.decrypt(encryptedSecret);
      if (this.totp.verify(secret, tokenOrRecoveryCode)) return true;
    }

    return this.repository.consumeRecoveryCode(
      tenantId,
      userId,
      hashRecoveryCode(tokenOrRecoveryCode),
    );
  }

  async disable(tenantId: string, userId: string): Promise<void> {
    await this.repository.disableMfa(tenantId, userId);
  }
}

export function createRecoveryCode(): string {
  return randomBytes(9).toString('base64url').toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase(), 'utf8').digest('hex');
}

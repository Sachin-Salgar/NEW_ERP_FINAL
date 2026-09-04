export interface MfaSecretProtector {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

export interface TotpProvider {
  generateSecret(): string;
  verify(secret: string, token: string, at?: Date): boolean;
}

export interface MfaRepository {
  createEnrollment(tenantId: string, userId: string, encryptedSecret: string, expiresAt: Date): Promise<void>;
  getPendingEnrollment(tenantId: string, userId: string): Promise<{ encryptedSecret: string; expiresAt: Date } | null>;
  activateEnrollment(tenantId: string, userId: string, encryptedSecret: string, recoveryCodeHashes: string[]): Promise<void>;
  getEnabledSecret(tenantId: string, userId: string): Promise<string | null>;
  consumeRecoveryCode(tenantId: string, userId: string, recoveryCodeHash: string): Promise<boolean>;
  disableMfa(tenantId: string, userId: string): Promise<void>;
}

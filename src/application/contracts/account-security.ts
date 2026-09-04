export interface AccountSecurityTokenRecord {
  tenantId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface AccountSecurityAccount {
  id: string;
  tenantId: string;
  email: string;
  status: string;
}

export interface AccountSecurityRepository {
  /** Global identity lookup returns only candidate accounts; tenant-owned data is loaded under RLS. */
  findAccountCandidates(identifier: string): Promise<AccountSecurityAccount[]>;
  findUserByIdentifier(tenantId: string, identifier: string): Promise<AccountSecurityAccount | null>;
  createEmailVerificationToken(record: AccountSecurityTokenRecord): Promise<void>;
  consumeEmailVerificationToken(tenantId: string, tokenHash: string, consumedAt: Date): Promise<boolean>;
  createPasswordResetToken(record: AccountSecurityTokenRecord): Promise<void>;
  consumePasswordResetToken(
    tenantId: string,
    tokenHash: string,
    passwordHash: string,
    consumedAt: Date,
  ): Promise<boolean>;
}

export interface AccountSecurityNotificationPort {
  sendEmailVerification(input: {
    tenantId: string;
    userId: string;
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void>;
  sendPasswordReset(input: {
    tenantId: string;
    userId: string;
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void>;
}

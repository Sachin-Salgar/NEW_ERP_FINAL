export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  organizationId?: string | null;
  defaultBranchId?: string | null;
  username: string;
  email: string;
  status: string;
}

export interface SessionRecord {
  id: string;
  tenantId: string;
  userId: string;
  organizationId?: string | null;
  branchId?: string | null;
  accessTokenId?: string | null;
  isActive: boolean;
  expiresAt: Date;
  loginAt: Date;
  lastActivityAt: Date;
  revokedAt?: Date | null;
  logoutAt?: Date | null;
}

export interface AuthenticationResult {
  success: boolean;
  user?: AuthenticatedUser;
  session?: SessionRecord;
  reason?: string;
}

export interface CreateSessionInput {
  tenantId: string;
  userId: string;
  organizationId?: string | null;
  branchId?: string | null;
  accessTokenId?: string | null;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
  device?: string | null;
  refreshTokenHash: string;
}

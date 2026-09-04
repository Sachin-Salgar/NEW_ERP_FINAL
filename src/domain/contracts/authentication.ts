export type AuthTokenType = 'access' | 'refresh';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  organizationId?: string | null;
  activeLocationId?: string | null;
  defaultLocationId?: string | null;
  defaultBranchId?: string | null;
  username: string;
  email: string;
  status: string;
  roles?: string[];
  permissions?: string[];
}

export interface SessionRecord {
  id: string;
  tenantId: string;
  userId: string;
  organizationId?: string | null;
  locationId?: string | null;
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
  accessToken?: string;
  refreshToken?: string;
  reason?: string;
  failureTenantId?: string;
  failureUserId?: string;
  retryAfterSeconds?: number;
}

export interface CreateSessionInput {
  id?: string;
  tenantId: string;
  userId: string;
  organizationId?: string | null;
  locationId?: string | null;
  branchId?: string | null;
  accessTokenId?: string | null;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
  device?: string | null;
  refreshTokenHash: string;
}

export interface AccessTokenClaims {
  sub: string;
  tenantId: string;
  sessionId: string;
  tokenType: 'access';
  iss: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenClaims {
  sub: string;
  tenantId: string;
  sessionId: string;
  tokenType: 'refresh';
  iss: string;
  iat: number;
  exp: number;
}

export type JwtTokenClaims = AccessTokenClaims | RefreshTokenClaims;

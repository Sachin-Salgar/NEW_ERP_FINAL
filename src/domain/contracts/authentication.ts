export type AuthTokenType = 'access' | 'refresh';
export type AuthenticationContextType = 'tenant' | 'platform';

export interface AuthenticatedUser {
  id: string;
  identityId?: string;
  tenantId: string;
  organizationId?: string | null;
  branchId?: string | null;
  activeLocationId?: string | null;
  defaultLocationId?: string | null;
  defaultBranchId?: string | null;
  financialYearId?: string | null;
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
  identityId?: string;
  contextType?: AuthenticationContextType;
  membershipId?: string | null;
  tenantMembershipId?: string | null;
  platformMembershipId?: string | null;
  securityVersion?: number;
  organizationId?: string | null;
  locationId?: string | null;
  branchId?: string | null;
  financialYearId?: string | null;
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
  financialYearId?: string | null;
  accessTokenId?: string | null;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
  device?: string | null;
  refreshTokenHash: string;
  identityId?: string;
  contextType?: AuthenticationContextType;
  tenantMembershipId?: string | null;
  platformMembershipId?: string | null;
  securityVersion?: number;
}

export interface AccessTokenClaims {
  sub: string;
  tenantId: string | null;
  sessionId: string;
  contextType?: AuthenticationContextType;
  membershipId?: string;
  tokenType: 'access';
  iss: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenClaims {
  sub: string;
  tenantId: string | null;
  sessionId: string;
  contextType?: AuthenticationContextType;
  membershipId?: string;
  tokenType: 'refresh';
  iss: string;
  iat: number;
  exp: number;
}

export type JwtTokenClaims = AccessTokenClaims | RefreshTokenClaims;

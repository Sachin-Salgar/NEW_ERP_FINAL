import type { PermissionDescriptor } from '../../domain/contracts/authorization.js';
import type {
  AuthenticatedUser,
  AuthenticationResult,
  CreateSessionInput,
  SessionRecord,
} from '../../domain/contracts/authentication.js';
import type { TenantBootstrapInput, TenantBootstrapResult } from '../../domain/contracts/bootstrap.js';

/**
 * @deprecated Repository contracts are owned by the domain layer. New code must
 * import them directly from `../../domain/contracts/repositories.js`.
 *
 * These type-only re-exports are retained as a bounded compatibility bridge for
 * legacy consumers while preserving a single source of truth in the domain.
 * No repository interface may be declared in this application-layer module.
 */
export type {
  AuthenticationRepository,
  AuthorizationRepository,
  BranchRecord,
  CoreEnterpriseRepository,
  LocationRecord,
  LoginCandidate,
  OrganizationRecord,
  PlatformBootstrapRepository,
  SessionRepository,
  TenantBootstrapRepository,
  UserAccountRecord,
  UserAdminRecord,
  UserBranchAccessRecord,
  UserOrganizationAccessRecord,
  UserRegistrationRecord,
  UserRegistrationRepository,
  UserRepository,
} from '../../domain/contracts/repositories.js';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hashValue: string): Promise<boolean>;
}

export interface TokenService {
  createAccessToken(input: { userId: string; tenantId: string; sessionId: string; expiresInSeconds?: number }): string;
  createRefreshToken(input: { userId: string; tenantId: string; sessionId: string; expiresInSeconds?: number }): string;
  verifyAccessToken(token: string): {
    sub: string;
    tenantId: string;
    sessionId: string;
    tokenType: 'access';
    iss: string;
    iat: number;
    exp: number;
  };
  verifyRefreshToken(token: string): {
    sub: string;
    tenantId: string;
    sessionId: string;
    tokenType: 'refresh';
    iss: string;
    iat: number;
    exp: number;
  };
  hashTokenValue(token: string): string;
}

export interface UserRegistrationInput {
  username: string;
  email: string;
  password: string;
  organizationId?: string | null;
  defaultBranchId?: string | null;
  defaultLocationId?: string | null;
  roleCode?: string;
}

export interface ReferenceDataSummary {
  subscriptionPlans: number;
  modules: number;
  permissions: number;
}

export interface PermissionLookupResult {
  permissionKey: string;
  source: 'role' | 'direct';
}

export interface TokenSessionService {
  createSession(input: CreateSessionInput): Promise<SessionRecord>;
  validateSession(sessionId: string, tenantId: string): Promise<AuthenticatedUser | null>;
  invalidateSession(sessionId: string, tenantId: string): Promise<void>;
}

export interface AuthService {
  authenticate(identifier: string, password: string): Promise<AuthenticationResult>;
  validateSession(sessionId: string, tenantId: string): Promise<AuthenticatedUser | null>;
  invalidateSession(sessionId: string, tenantId: string): Promise<void>;
}

export interface PermissionService {
  hasPermission(tenantId: string, userId: string, permissionKey: string): Promise<boolean>;
  getPermissions(tenantId: string, userId: string): Promise<PermissionDescriptor[]>;
}

export interface TenantBootstrapServicePort {
  bootstrapTenant(input: TenantBootstrapInput): Promise<TenantBootstrapResult>;
}

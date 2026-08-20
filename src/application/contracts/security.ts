import type { PermissionDescriptor, UserPermissionRecord } from '../../domain/contracts/authorization.js';
import type { AuthenticatedUser, AuthenticationResult, SessionRecord, CreateSessionInput } from '../../domain/contracts/authentication.js';
import type { TenantBootstrapInput, TenantBootstrapResult } from '../../domain/contracts/bootstrap.js';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hashValue: string): Promise<boolean>;
}

export interface TokenService {
  createAccessToken(input: { userId: string; tenantId: string; sessionId: string; expiresInSeconds?: number }): string;
  createRefreshToken(input: { userId: string; tenantId: string; sessionId: string; expiresInSeconds?: number }): string;
  verifyAccessToken(token: string): { sub: string; tenantId: string; sessionId: string; tokenType: 'access'; iss: string; iat: number; exp: number };
  verifyRefreshToken(token: string): { sub: string; tenantId: string; sessionId: string; tokenType: 'refresh'; iss: string; iat: number; exp: number };
  hashTokenValue(token: string): string;
}

export interface PlatformBootstrapRepository {
  seedSubscriptionPlans(plans: Array<{ name: string; description?: string | null; priceMonthly: number; maxUsers?: number | null; maxStorageGb?: number | null; isActive?: boolean }>): Promise<void>;
  seedModules(modules: Array<{ code: string; name: string; moduleGroup?: string; description?: string | null; icon?: string | null; route?: string | null; isCore?: boolean; sortOrder?: number; parentModuleCode?: string | null }>): Promise<void>;
  seedPermissions(permissions: Array<{ moduleCode: string; resource: string; action: string; scope?: 'own' | 'branch' | 'organization' | 'tenant' | 'global'; permissionKey: string; displayName: string; description?: string | null; isSystem?: boolean }>): Promise<void>;
}

export interface UserRepository {
  findByTenantAndIdentifier(tenantId: string, identifier: string): Promise<({
    id: string;
    tenantId: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status: string;
  }) | null>;
  findById(tenantId: string, userId: string): Promise<({
    id: string;
    tenantId: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status: string;
  }) | null>;
  getPermissionKeysForUser(tenantId: string, userId: string): Promise<UserPermissionRecord[]>;
}

export interface SessionRepository {
  createSession(input: CreateSessionInput): Promise<SessionRecord>;
  findSession(sessionId: string, tenantId: string): Promise<SessionRecord | null>;
  findSessionByRefreshTokenHash(tenantId: string, refreshTokenHash: string): Promise<SessionRecord | null>;
  invalidateSession(sessionId: string, tenantId: string): Promise<void>;
}

export interface UserRegistrationInput {
  username: string;
  email: string;
  password: string;
  organizationId?: string | null;
  defaultBranchId?: string | null;
  roleCode?: string;
}

export interface UserRegistrationRecord {
  id: string;
  tenantId: string;
  organizationId?: string | null;
  defaultBranchId?: string | null;
  username: string;
  email: string;
  status: string;
}

export interface UserRegistrationRepository {
  findById(tenantId: string, userId: string): Promise<({
    id: string;
    tenantId: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status: string;
  }) | null>;
  findByTenantAndIdentifier(tenantId: string, identifier: string): Promise<({
    id: string;
    tenantId: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status: string;
  }) | null>;
  findRoleByTenantAndCode(tenantId: string, code: string): Promise<{ id: string; tenantId: string; code: string; name: string } | null>;
  createRole(tenantId: string, code: string, name: string): Promise<{ id: string; tenantId: string; code: string; name: string }>;
  createUser(input: {
    id?: string;
    tenantId: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status?: string;
  }): Promise<UserRegistrationRecord>;
  assignUserRole(tenantId: string, userId: string, roleId: string): Promise<void>;
}

export interface TenantBootstrapRepository {
  bootstrapTenant(input: TenantBootstrapInput): Promise<TenantBootstrapResult>;
}

export interface AuthorizationRepository {
  getPermissionKeysForUser(tenantId: string, userId: string): Promise<UserPermissionRecord[]>;
}

export interface AuthenticationRepository extends UserRepository, SessionRepository, UserRegistrationRepository {}

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
  authenticate(tenantId: string, identifier: string, password: string): Promise<AuthenticationResult>;
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

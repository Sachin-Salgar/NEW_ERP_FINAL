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

export interface LoginCandidate {
  userId: string;
  tenantId: string;
}

export interface UserRepository {
  findLoginCandidates(identifier: string): Promise<LoginCandidate[]>;
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
  assignUserToOrganization(tenantId: string, userId: string, organizationId: string): Promise<boolean>;
  assignUserRole(tenantId: string, userId: string, roleId: string): Promise<void>;
}

export interface TenantBootstrapRepository {
  bootstrapTenant(input: TenantBootstrapInput): Promise<TenantBootstrapResult>;
}

export interface OrganizationRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  legalName?: string | null;
  gstNo?: string | null;
  panNo?: string | null;
  cinNo?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  baseCurrency: string;
  fiscalCalendar: string;
  status: 'active' | 'inactive' | 'archived';
  isDefault: boolean;
  remarks?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  isDeleted?: boolean;
}

export interface BranchRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  code: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  isHeadOffice: boolean;
  isDefault: boolean;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  timezone: string;
  remarks?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  isDeleted?: boolean;
}

export interface LocationRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string | null;
  status: 'active' | 'inactive' | 'archived';
  isDefault: boolean;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  timezone: string;
  remarks?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  isDeleted?: boolean;
}

export interface UserAdminRecord {
  id: string;
  tenantId: string;
  organizationId?: string | null;
  defaultBranchId?: string | null;
  username: string;
  email: string;
  status: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  isDeleted?: boolean;
}

export interface CoreEnterpriseRepository {
  generateOrganizationCode(tenantId: string): Promise<string>;
  createOrganization(tenantId: string, input: { code?: string | null; name: string; legalName?: string | null; gstNo?: string | null; panNo?: string | null; cinNo?: string | null; email?: string | null; phone?: string | null; website?: string | null; baseCurrency?: string; fiscalCalendar?: string; status?: 'active' | 'inactive' | 'archived'; isDefault?: boolean; remarks?: string | null }): Promise<OrganizationRecord>;
  listOrganizations(tenantId: string): Promise<OrganizationRecord[]>;
  getOrganizationById(tenantId: string, organizationId: string): Promise<OrganizationRecord | null>;
  updateOrganization(tenantId: string, organizationId: string, changes: Partial<Pick<OrganizationRecord, 'code' | 'name' | 'legalName' | 'gstNo' | 'panNo' | 'cinNo' | 'email' | 'phone' | 'website' | 'baseCurrency' | 'fiscalCalendar' | 'status' | 'isDefault' | 'remarks'>>): Promise<OrganizationRecord | null>;
  deactivateOrganization(tenantId: string, organizationId: string): Promise<boolean>;
  generateBranchCode(tenantId: string, organizationId: string): Promise<string>;
  createBranch(tenantId: string, organizationId: string, input: { code?: string | null; name: string; status?: 'active' | 'inactive' | 'archived'; isHeadOffice?: boolean; isDefault?: boolean; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; district?: string | null; state?: string | null; country?: string | null; postalCode?: string | null; timezone?: string; remarks?: string | null }): Promise<BranchRecord>;
  listBranches(tenantId: string, organizationId: string): Promise<BranchRecord[]>;
  getBranchById(tenantId: string, organizationId: string, branchId: string): Promise<BranchRecord | null>;
  updateBranch(tenantId: string, organizationId: string, branchId: string, changes: Partial<Pick<BranchRecord, 'code' | 'name' | 'status' | 'isHeadOffice' | 'isDefault' | 'addressLine1' | 'addressLine2' | 'city' | 'district' | 'state' | 'country' | 'postalCode' | 'timezone' | 'remarks'>>): Promise<BranchRecord | null>;
  deactivateBranch(tenantId: string, organizationId: string, branchId: string): Promise<boolean>;
  generateLocationCode(tenantId: string, organizationId: string): Promise<string>;
  createLocation(tenantId: string, organizationId: string, input: { code: string; name: string; description?: string | null; status?: 'active' | 'inactive' | 'archived'; isDefault?: boolean; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; country?: string | null; postalCode?: string | null; timezone?: string }): Promise<LocationRecord>;
  listLocations(tenantId: string, organizationId: string): Promise<LocationRecord[]>;
  listAccessibleLocationsForUser(tenantId: string, userId: string, organizationId?: string | null): Promise<LocationRecord[]>;
  getLocationById(tenantId: string, organizationId: string, locationId: string): Promise<LocationRecord | null>;
  getAccessibleLocationByIdForUser(tenantId: string, userId: string, locationId: string, organizationId?: string | null): Promise<LocationRecord | null>;
  validateLocationAccess(tenantId: string, userId: string, locationId: string, organizationId?: string | null): Promise<boolean>;
  updateLocation(tenantId: string, organizationId: string, locationId: string, changes: Partial<Pick<LocationRecord, 'code' | 'name' | 'description' | 'status' | 'isDefault' | 'addressLine1' | 'addressLine2' | 'city' | 'state' | 'country' | 'postalCode' | 'timezone'>>): Promise<LocationRecord | null>;
  deactivateLocation(tenantId: string, organizationId: string, locationId: string): Promise<boolean>;
  listUsers(tenantId: string): Promise<UserAdminRecord[]>;
  getUserById(tenantId: string, userId: string): Promise<UserAdminRecord | null>;
  updateUser(tenantId: string, userId: string, changes: Partial<Pick<UserAdminRecord, 'username' | 'email' | 'organizationId' | 'defaultBranchId' | 'status'>>): Promise<UserAdminRecord | null>;
  assignUserToOrganization(tenantId: string, userId: string, organizationId: string): Promise<boolean>;
  assignUserToBranch(tenantId: string, userId: string, branchId: string): Promise<boolean>;
  activateUser(tenantId: string, userId: string): Promise<boolean>;
  deactivateUser(tenantId: string, userId: string): Promise<boolean>;
}

export interface AuthorizationRepository {
  getPermissionKeysForUser(tenantId: string, userId: string): Promise<UserPermissionRecord[]>;
  listRoles(tenantId: string): Promise<Array<{ id: string; tenantId: string; code: string; name: string; description?: string | null; isSystem: boolean; sortOrder: number; createdAt?: Date | string | null; updatedAt?: Date | string | null }>>;
  getRoleById(tenantId: string, roleId: string): Promise<{ id: string; tenantId: string; code: string; name: string; description?: string | null; isSystem: boolean; sortOrder: number; createdAt?: Date | string | null; updatedAt?: Date | string | null } | null>;
  createRole(tenantId: string, input: { code: string; name: string; description?: string | null; isSystem?: boolean; sortOrder?: number }): Promise<{ id: string; tenantId: string; code: string; name: string; description?: string | null; isSystem: boolean; sortOrder: number; createdAt?: Date | string | null; updatedAt?: Date | string | null }>;
  updateRole(tenantId: string, roleId: string, changes: { code?: string; name?: string; description?: string | null; isSystem?: boolean; sortOrder?: number }): Promise<{ id: string; tenantId: string; code: string; name: string; description?: string | null; isSystem: boolean; sortOrder: number; createdAt?: Date | string | null; updatedAt?: Date | string | null } | null>;
  listPermissions(tenantId: string): Promise<Array<{ id: string; moduleCode: string; resource: string; action: string; scope: 'own' | 'branch' | 'organization' | 'tenant' | 'global'; permissionKey: string; displayName: string; description?: string | null; isSystem: boolean }>>;
  assignPermissionsToRole(tenantId: string, roleId: string, permissionKeys: string[]): Promise<number>;
  removePermissionsFromRole(tenantId: string, roleId: string, permissionKeys: string[]): Promise<number>;
  replacePermissionsForRole(tenantId: string, roleId: string, permissionKeys: string[]): Promise<number>;
  getPermissionsForRole(tenantId: string, roleId: string): Promise<PermissionDescriptor[]>;
  assignRoleToUser(tenantId: string, userId: string, roleId: string): Promise<boolean>;
  revokeRoleFromUser(tenantId: string, userId: string, roleId: string): Promise<boolean>;
  getUserEffectivePermissions(tenantId: string, userId: string): Promise<PermissionDescriptor[]>;
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

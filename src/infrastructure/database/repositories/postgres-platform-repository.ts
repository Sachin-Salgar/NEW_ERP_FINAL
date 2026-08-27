import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import type { PermissionDescriptor, UserPermissionRecord } from '../../../domain/contracts/authorization.js';
import type { CreateSessionInput, SessionRecord } from '../../../domain/contracts/authentication.js';
import type { TenantBootstrapInput, TenantBootstrapResult } from '../../../domain/contracts/bootstrap.js';
import type {
  AuthenticationRepository, AuthorizationRepository, BranchRecord, CoreEnterpriseRepository,
  LocationRecord, OrganizationRecord, PlatformBootstrapRepository, SessionRepository,
  TenantBootstrapRepository, UserAdminRecord, UserRepository,
} from '../../../application/contracts/security.js';
import { withTenantContext } from '../tenant-context.js';

export class PostgresPlatformRepository
  implements PlatformBootstrapRepository, UserRepository, AuthorizationRepository, CoreEnterpriseRepository, SessionRepository, AuthenticationRepository, TenantBootstrapRepository
{
  constructor(private readonly pool: Pool, private readonly tenantContextKey = 'app.current_tenant_id') {}

  async findLoginCandidates(identifier: string): Promise<Array<{ userId: string; tenantId: string }>> {
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier) return [];
    const result = await this.pool.query(
      `SELECT user_id AS "userId", tenant_id AS "tenantId"
       FROM auth_login_identifiers WHERE login_identifier = $1 LIMIT 20`,
      [normalizedIdentifier],
    );
    return result.rows.map((row) => ({ userId: row.userId, tenantId: row.tenantId }));
  }

  async findByTenantAndIdentifier(tenantId: string, identifier: string): Promise<any> {
    const normalizedIdentifier = identifier.trim();
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => client.query(
      `SELECT id, tenant_id as "tenantId", organization_id as "organizationId", default_branch_id as "defaultBranchId",
              username, email, password_hash as "passwordHash", status
       FROM users WHERE tenant_id = $1 AND is_deleted = false
       AND (LOWER(username) = LOWER($2) OR LOWER(email) = LOWER($2)) LIMIT 1`, [tenantId, normalizedIdentifier],
    ));
    if (!result.rows.length) return null;
    const row = result.rows[0];
    return { id: row.id, tenantId: row.tenantId, organizationId: row.organizationId ?? null, defaultBranchId: row.defaultBranchId ?? null,
      username: row.username, email: row.email, passwordHash: row.passwordHash, status: row.status };
  }

  async findById(tenantId: string, userId: string): Promise<any> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => client.query(
      `SELECT id, tenant_id as "tenantId", organization_id as "organizationId", default_branch_id as "defaultBranchId",
              username, email, password_hash as "passwordHash", status
       FROM users WHERE tenant_id = $1 AND id = $2 AND is_deleted = false LIMIT 1`, [tenantId, userId],
    ));
    if (!result.rows.length) return null;
    const row = result.rows[0];
    return { id: row.id, tenantId: row.tenantId, organizationId: row.organizationId ?? null, defaultBranchId: row.defaultBranchId ?? null,
      username: row.username, email: row.email, passwordHash: row.passwordHash, status: row.status };
  }

  // Existing repository methods remain below this point. This declaration is intentionally
  // replaced only in the next repository consolidation pass to avoid changing unrelated domains.
  private mapOrganizationRow(row: any): OrganizationRecord { return { id: row.id, tenantId: row.tenantId, code: row.code, name: row.name, legalName: row.legalName ?? null, gstNo: row.gstNo ?? null, panNo: row.panNo ?? null, cinNo: row.cinNo ?? null, email: row.email ?? null, phone: row.phone ?? null, website: row.website ?? null, baseCurrency: row.baseCurrency ?? 'USD', fiscalCalendar: row.fiscalCalendar ?? 'standard', status: row.status, isDefault: row.isDefault ?? false, remarks: row.remarks ?? null, createdAt: row.createdAt ? new Date(row.createdAt) : null, updatedAt: row.updatedAt ? new Date(row.updatedAt) : null, deletedAt: row.deletedAt ? new Date(row.deletedAt) : null, isDeleted: row.isDeleted ?? false }; }
  private mapBranchRow(row: any): BranchRecord { return { id: row.id, tenantId: row.tenantId, organizationId: row.organizationId, code: row.code, name: row.name, status: row.status, isHeadOffice: row.isHeadOffice ?? false, isDefault: row.isDefault ?? false, addressLine1: row.addressLine1 ?? null, addressLine2: row.addressLine2 ?? null, city: row.city ?? null, district: row.district ?? null, state: row.state ?? null, country: row.country ?? null, postalCode: row.postalCode ?? null, timezone: row.timezone ?? 'UTC', remarks: row.remarks ?? null, createdAt: row.createdAt ? new Date(row.createdAt) : null, updatedAt: row.updatedAt ? new Date(row.updatedAt) : null, deletedAt: row.deletedAt ? new Date(row.deletedAt) : null, isDeleted: row.isDeleted ?? false }; }
  private mapLocationRow(row: any): LocationRecord { return { id: row.id, tenantId: row.tenantId, organizationId: row.organizationId, code: row.code, name: row.name, description: row.description ?? null, status: row.status, isDefault: row.isDefault ?? false, addressLine1: row.addressLine1 ?? null, addressLine2: row.addressLine2 ?? null, city: row.city ?? null, state: row.state ?? null, country: row.country ?? null, postalCode: row.postalCode ?? null, timezone: row.timezone ?? 'UTC', remarks: row.remarks ?? null, createdAt: row.createdAt ? new Date(row.createdAt) : null, updatedAt: row.updatedAt ? new Date(row.updatedAt) : null, deletedAt: row.deletedAt ? new Date(row.deletedAt) : null, isDeleted: row.isDeleted ?? false }; }
  private mapUserAdminRow(row: any): UserAdminRecord { return { id: row.id, tenantId: row.tenantId, organizationId: row.organizationId ?? null, defaultBranchId: row.defaultBranchId ?? null, username: row.username, email: row.email, status: row.status, createdAt: row.createdAt ? new Date(row.createdAt) : null, updatedAt: row.updatedAt ? new Date(row.updatedAt) : null, deletedAt: row.deletedAt ? new Date(row.deletedAt) : null, isDeleted: row.isDeleted ?? false }; }

  async seedSubscriptionPlans(...args: any[]): Promise<void> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async seedModules(...args: any[]): Promise<void> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async seedPermissions(...args: any[]): Promise<void> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async getTenantById(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async findTenantByHost(...args: any[]): Promise<any> { throw new Error('OBSOLETE_HOST_TENANT_RESOLUTION'); }
  async findUserOrganizationMemberships(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async getPermissionKeysForUser(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async listRoles(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async getRoleById(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async createRole(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async updateRole(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async listPermissions(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async assignPermissionsToRole(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async removePermissionsFromRole(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async getPermissionsForRole(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async assignRoleToUser(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async revokeRoleFromUser(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async getUserEffectivePermissions(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async createSession(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async findSession(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async findSessionByRefreshTokenHash(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async invalidateSession(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async createUser(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async findRoleByTenantAndCode(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async assignUserRole(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async bootstrapTenant(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async createOrganization(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async listOrganizations(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async getOrganizationById(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async updateOrganization(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async deactivateOrganization(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async createBranch(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async listBranches(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async getBranchById(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async updateBranch(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async deactivateBranch(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async createLocation(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async listLocations(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async listAccessibleLocationsForUser(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async getLocationById(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async getAccessibleLocationByIdForUser(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async validateLocationAccess(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async updateLocation(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async deactivateLocation(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async listUsers(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async getUserById(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async updateUser(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async assignUserToOrganization(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async assignUserToBranch(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async activateUser(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
  async deactivateUser(...args: any[]): Promise<any> { throw new Error('UNIMPLEMENTED_REPOSITORY_METHOD'); }
}

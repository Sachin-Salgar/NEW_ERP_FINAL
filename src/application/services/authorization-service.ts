import type {
  PermissionDescriptor,
  PermissionCheckResult,
  RoleDescriptor,
} from '../../domain/contracts/authorization.js';
import type { AuthorizationRepository } from '../../domain/contracts/repositories.js';

export class AuthorizationService {
  constructor(private readonly authorizationRepository: AuthorizationRepository) {}

  async createRole(
    tenantId: string,
    input: { code: string; name: string; description?: string | null; isSystem?: boolean; sortOrder?: number },
  ): Promise<RoleDescriptor> {
    return this.authorizationRepository.createRole(tenantId, input);
  }

  async listRoles(tenantId: string): Promise<RoleDescriptor[]> {
    return this.authorizationRepository.listRoles(tenantId);
  }

  async getRole(tenantId: string, roleId: string): Promise<RoleDescriptor | null> {
    return this.authorizationRepository.getRoleById(tenantId, roleId);
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    changes: { code?: string; name?: string; description?: string | null; isSystem?: boolean; sortOrder?: number },
  ): Promise<RoleDescriptor | null> {
    return this.authorizationRepository.updateRole(tenantId, roleId, changes);
  }

  async listPermissions(tenantId: string): Promise<PermissionDescriptor[]> {
    return this.authorizationRepository.listPermissions(tenantId);
  }

  async assignPermissionsToRole(tenantId: string, roleId: string, permissionKeys: string[]): Promise<number> {
    return this.authorizationRepository.assignPermissionsToRole(tenantId, roleId, permissionKeys);
  }

  async removePermissionsFromRole(tenantId: string, roleId: string, permissionKeys: string[]): Promise<number> {
    return this.authorizationRepository.removePermissionsFromRole(tenantId, roleId, permissionKeys);
  }

  async replacePermissionsForRole(tenantId: string, roleId: string, permissionKeys: string[]): Promise<number> {
    return this.authorizationRepository.replacePermissionsForRole(tenantId, roleId, permissionKeys);
  }

  async getPermissionsForRole(tenantId: string, roleId: string): Promise<PermissionDescriptor[]> {
    return this.authorizationRepository.getPermissionsForRole(tenantId, roleId);
  }

  async assignRoleToUser(tenantId: string, userId: string, roleId: string): Promise<boolean> {
    return this.authorizationRepository.assignRoleToUser(tenantId, userId, roleId);
  }

  async revokeRoleFromUser(tenantId: string, userId: string, roleId: string): Promise<boolean> {
    return this.authorizationRepository.revokeRoleFromUser(tenantId, userId, roleId);
  }

  async getRolesForUser(tenantId: string, userId: string): Promise<RoleDescriptor[]> {
    return this.authorizationRepository.getRolesForUser(tenantId, userId);
  }

  async getEffectivePermissions(tenantId: string, userId: string): Promise<PermissionDescriptor[]> {
    return this.authorizationRepository.getUserEffectivePermissions(tenantId, userId);
  }

  async hasPermission(tenantId: string, userId: string, permissionKey: string): Promise<boolean> {
    const permissions = await this.authorizationRepository.getPermissionKeysForUser(tenantId, userId);
    return permissions.some((entry) => entry.permissionKey === permissionKey);
  }

  async hasAnyPermission(tenantId: string, userId: string, permissionKeys: string[]): Promise<PermissionCheckResult[]> {
    const permissions = await this.authorizationRepository.getPermissionKeysForUser(tenantId, userId);
    const permissionSet = new Set(permissions.map((entry) => entry.permissionKey));

    return permissionKeys.map((permissionKey) => ({
      permissionKey,
      allowed: permissionSet.has(permissionKey),
      source: permissions.find((entry) => entry.permissionKey === permissionKey)?.source ?? 'none',
    }));
  }

  async getPermissions(tenantId: string, userId: string): Promise<PermissionDescriptor[]> {
    return this.getEffectivePermissions(tenantId, userId);
  }
}

import type { PermissionDescriptor, PermissionCheckResult } from '../../domain/contracts/authorization.js';
import type { AuthorizationRepository } from '../contracts/security.js';

export class AuthorizationService {
  constructor(private readonly authorizationRepository: AuthorizationRepository) {}

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
    const permissions = await this.authorizationRepository.getPermissionKeysForUser(tenantId, userId);
    return permissions.map((permission) => ({
      id: permission.permissionKey,
      moduleCode: 'platform',
      resource: permission.permissionKey.split('.')[0] ?? 'platform',
      action: permission.permissionKey.split('.').slice(1).join('.') || 'read',
      scope: 'tenant',
      permissionKey: permission.permissionKey,
      displayName: permission.permissionKey,
      description: `Permission granted via ${permission.source}.`,
      isSystem: true,
    }));
  }
}

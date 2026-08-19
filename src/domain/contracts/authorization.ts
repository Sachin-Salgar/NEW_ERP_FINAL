export type PermissionScope = 'own' | 'branch' | 'organization' | 'tenant' | 'global';

export interface PermissionDescriptor {
  id: string;
  moduleCode: string;
  resource: string;
  action: string;
  scope: PermissionScope;
  permissionKey: string;
  displayName: string;
  description?: string | null;
  isSystem: boolean;
}

export interface UserPermissionContext {
  tenantId: string;
  userId: string;
  organizationId?: string | null;
  branchId?: string | null;
}

export interface PermissionCheckResult {
  allowed: boolean;
  permissionKey: string;
  source: 'role' | 'direct' | 'none';
}

export interface UserPermissionRecord {
  tenantId: string;
  userId: string;
  permissionKey: string;
  source: 'role' | 'direct';
}

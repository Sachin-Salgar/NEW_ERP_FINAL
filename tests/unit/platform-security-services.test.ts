// @ts-nocheck
import { describe, expect, it } from 'vitest';

import { AuthenticationService } from '../../src/application/services/authentication-service.js';
import { AuthorizationService } from '../../src/application/services/authorization-service.js';
import { DEFAULT_PLATFORM_SEED } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';

class FakeTenantBootstrapRepository {
  public received: any;

  async bootstrapTenant(input: any) {
    this.received = input;
    return {
      tenantId: input.tenant.id!,
      branchId: input.branch.id!,
      userId: input.administrator.id!,
      roleId: input.role.id!,
    };
  }
}

class FakeAuthRepository {
  async findLoginCandidates() {
    return [{ tenantId: 'tenant-1', userId: 'user-1' }];
  }

  async findByTenantAndIdentifier() {
    return {
      id: 'user-1',
      tenantId: 'tenant-1',
      defaultBranchId: 'branch-1',
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: await new BcryptPasswordHasher().hash('Password123!'),
      status: 'active',
    };
  }

  async findById() {
    return {
      id: 'user-1',
      tenantId: 'tenant-1',
      defaultBranchId: 'branch-1',
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: await new BcryptPasswordHasher().hash('Password123!'),
      status: 'active',
    };
  }

  async getPermissionKeysForUser() {
    return [
      { tenantId: 'tenant-1', userId: 'user-1', permissionKey: 'role.manage', source: 'role' as const },
      { tenantId: 'tenant-1', userId: 'user-1', permissionKey: 'user.manage', source: 'direct' as const },
    ];
  }

  async findRoleByTenantAndCode() {
    return { id: 'role-1', tenantId: 'tenant-1', code: 'admin', name: 'Administrator' };
  }

  async createRole() {
    return { id: 'role-1', tenantId: 'tenant-1', code: 'admin', name: 'Administrator' };
  }

  async createUser(input: any) {
    return {
      id: input.id ?? 'user-2',
      tenantId: input.tenantId,
      defaultBranchId: input.defaultBranchId ?? null,
      username: input.username,
      email: input.email,
      status: input.status ?? 'active',
    };
  }

  async assignUserRole() {
    return undefined;
  }

  async createSession(input: any) {
    return {
      id: 'session-1',
      tenantId: input.tenantId,
      userId: input.userId,
      branchId: input.branchId,
      accessTokenId: input.accessTokenId,
      isActive: true,
      expiresAt: new Date(Date.now() + 3600_000),
      loginAt: new Date(),
      lastActivityAt: new Date(),
      revokedAt: null,
      logoutAt: null,
    };
  }

  async findSession() {
    return {
      id: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      branchId: 'branch-1',
      accessTokenId: null,
      isActive: true,
      expiresAt: new Date(Date.now() + 3600_000),
      loginAt: new Date(),
      lastActivityAt: new Date(),
      revokedAt: null,
      logoutAt: null,
    };
  }

  async findSessionByRefreshTokenHash() {
    return {
      id: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      branchId: 'branch-1',
      accessTokenId: null,
      isActive: true,
      expiresAt: new Date(Date.now() + 3600_000),
      loginAt: new Date(),
      lastActivityAt: new Date(),
      revokedAt: null,
      logoutAt: null,
    };
  }

  async invalidateSession() {
    return undefined;
  }

  async listActiveSessions() {
    return [];
  }

  async invalidateAllSessions() {
    return 0;
  }

}

class FakeAuthorizationRepository {
  async getPermissionKeysForUser() {
    return [
      { tenantId: 'tenant-1', userId: 'user-1', permissionKey: 'role.manage', source: 'role' as const },
      { tenantId: 'tenant-1', userId: 'user-1', permissionKey: 'user.manage', source: 'direct' as const },
    ];
  }

  async listRoles() {
    return [];
  }
  async getRoleById() {
    return null;
  }
  async createRole(_tenantId: string, input: any) {
    return {
      id: 'role-1',
      tenantId: _tenantId,
      ...input,
      isSystem: !!input.isSystem,
      sortOrder: input.sortOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async updateRole() {
    return null;
  }
  async listPermissions() {
    return [];
  }
  async assignPermissionsToRole() {
    return 0;
  }
  async removePermissionsFromRole() {
    return 0;
  }
  async replacePermissionsForRole() {
    return 0;
  }
  async getPermissionsForRole() {
    return [];
  }
  async assignRoleToUser() {
    return false;
  }
  async revokeRoleFromUser() {
    return false;
  }
  async getRolesForUser() {
    return [];
  }
  async getUserEffectivePermissions() {
    return [];
  }
}

describe('Phase 2 platform security services', () => {
  it('hashes the administrator password during tenant bootstrap', async () => {
    const repository = new FakeTenantBootstrapRepository();
    const service = new TenantBootstrapService(repository, new BcryptPasswordHasher());

    const result = await service.bootstrapTenant({
      tenant: { name: 'Acme', subdomain: 'acme', slug: 'acme' },
      branch: { code: 'HO', name: 'Head Office' },
      administrator: { username: 'admin', email: 'admin@acme.test', password: 'Password123!' },
      role: { code: 'admin', name: 'Administrator' },
      permissions: ['role.manage', 'user.manage'],
    });

    expect(result.tenantId).toBeTruthy();
    expect(repository.received.administrator.password).not.toBe('Password123!');
    expect(repository.received.administrator.password.startsWith('$2')).toBe(true);
    expect(repository.received.permissions).toEqual(
      expect.arrayContaining(['user.read', 'user.create', 'user.update', 'user.activate', 'user.deactivate']),
    );
    expect(repository.received.permissions).not.toContain('user.manage');
  });

  it('publishes only granular User permissions in the platform catalog', () => {
    const userPermissions = DEFAULT_PLATFORM_SEED.permissions
      .filter((permission) => permission.resource === 'user')
      .map((permission) => permission.permissionKey);

    expect(userPermissions).toEqual(['user.read', 'user.create', 'user.update', 'user.activate', 'user.deactivate']);
    expect(userPermissions).not.toContain('user.manage');
  });

  it('publishes granular core and role-permission capabilities without active manage aliases', () => {
    const keys = new Set(DEFAULT_PLATFORM_SEED.permissions.map((permission) => permission.permissionKey));

    for (const key of [
      'branch.create',
      'branch.update',
      'branch.deactivate',
      'role.create',
      'role.update',
      'role_permission.read',
      'role_permission.grant',
      'role_permission.revoke',
      'security.session.read',
      'security.session.revoke',
      'security.session.revoke_all',
      'security.audit_log.read',
    ]) {
      expect(keys.has(key)).toBe(true);
    }
    for (const legacyKey of [
      'branch.manage',
      'role.manage',
      'permission.manage',
      'session.manage',
    ]) {
      expect(keys.has(legacyKey)).toBe(false);
    }
  });

  it('evaluates role and direct permissions for a user', async () => {
    const service = new AuthorizationService(new FakeAuthorizationRepository());

    await expect(service.hasPermission('tenant-1', 'user-1', 'role.manage')).resolves.toBe(true);
    await expect(service.hasPermission('tenant-1', 'user-1', 'permission.manage')).resolves.toBe(false);
  });

  it('authenticates a valid user and validates the created session', async () => {
    const repository = new FakeAuthRepository();
    const service = new AuthenticationService(repository, new BcryptPasswordHasher());

    const authResult = await service.authenticate('admin', 'Password123!');
    expect(authResult.success).toBe(true);
    expect(authResult.session?.userId).toBe('user-1');
    const user = await service.validateSession('session-1', 'tenant-1');
    expect(user?.username).toBe('admin');
  });
});

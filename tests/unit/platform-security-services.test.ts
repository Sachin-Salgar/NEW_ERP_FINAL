import { describe, expect, it } from 'vitest';

import { AuthenticationService } from '../../src/application/services/authentication-service.js';
import { AuthorizationService } from '../../src/application/services/authorization-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';

class FakeTenantBootstrapRepository {
  public received: any;

  async bootstrapTenant(input: any) {
    this.received = input;
    return {
      tenantId: input.tenant.id!,
      organizationId: input.organization.id!,
      branchId: input.branch.id!,
      userId: input.administrator.id!,
      roleId: input.role.id!,
    };
  }
}

class FakeAuthRepository {
  async findByTenantAndIdentifier() {
    return {
      id: 'user-1',
      tenantId: 'tenant-1',
      organizationId: 'org-1',
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
      organizationId: 'org-1',
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
      organizationId: input.organizationId ?? null,
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
      organizationId: input.organizationId,
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
      organizationId: 'org-1',
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
      organizationId: 'org-1',
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
}

class FakeAuthorizationRepository {
  async getPermissionKeysForUser() {
    return [
      { tenantId: 'tenant-1', userId: 'user-1', permissionKey: 'role.manage', source: 'role' as const },
      { tenantId: 'tenant-1', userId: 'user-1', permissionKey: 'user.manage', source: 'direct' as const },
    ];
  }

  async listRoles() { return []; }
  async getRoleById() { return null; }
  async createRole(_tenantId: string, input: any) { return { id: 'role-1', tenantId: _tenantId, ...input, isSystem: !!input.isSystem, sortOrder: input.sortOrder ?? 0, createdAt: new Date(), updatedAt: new Date() }; }
  async updateRole() { return null; }
  async listPermissions() { return []; }
  async assignPermissionsToRole() { return 0; }
  async removePermissionsFromRole() { return 0; }
  async assignRoleToUser() { return false; }
  async revokeRoleFromUser() { return false; }
  async getUserEffectivePermissions() { return []; }
}

describe('Phase 2 platform security services', () => {
  it('hashes the administrator password during tenant bootstrap', async () => {
    const repository = new FakeTenantBootstrapRepository();
    const service = new TenantBootstrapService(repository, new BcryptPasswordHasher());

    const result = await service.bootstrapTenant({
      tenant: { name: 'Acme', subdomain: 'acme', slug: 'acme' },
      organization: { code: 'ACME', name: 'Acme Corp' },
      branch: { code: 'HO', name: 'Head Office' },
      administrator: { username: 'admin', email: 'admin@acme.test', password: 'Password123!' },
      role: { code: 'admin', name: 'Administrator' },
      permissions: ['role.manage', 'user.manage'],
    });

    expect(result.tenantId).toBeTruthy();
    expect(repository.received.administrator.password).not.toBe('Password123!');
    expect(repository.received.administrator.password.startsWith('$2')).toBe(true);
  });

  it('evaluates role and direct permissions for a user', async () => {
    const service = new AuthorizationService(new FakeAuthorizationRepository());

    await expect(service.hasPermission('tenant-1', 'user-1', 'role.manage')).resolves.toBe(true);
    await expect(service.hasPermission('tenant-1', 'user-1', 'permission.manage')).resolves.toBe(false);
  });

  it('authenticates a valid user and validates the created session', async () => {
    const repository = new FakeAuthRepository();
    const service = new AuthenticationService(repository, new BcryptPasswordHasher());

    const authResult = await service.authenticate('tenant-1', 'admin', 'Password123!');
    expect(authResult.success).toBe(true);
    expect(authResult.session?.userId).toBe('user-1');
    const user = await service.validateSession('session-1', 'tenant-1');
    expect(user?.username).toBe('admin');
  });
});

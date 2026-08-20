import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import type { PermissionDescriptor, UserPermissionRecord } from '../../../domain/contracts/authorization.js';
import type { CreateSessionInput, SessionRecord } from '../../../domain/contracts/authentication.js';
import type { TenantBootstrapInput, TenantBootstrapResult } from '../../../domain/contracts/bootstrap.js';
import type {
  AuthenticationRepository,
  AuthorizationRepository,
  PlatformBootstrapRepository,
  SessionRepository,
  TenantBootstrapRepository,
  UserRepository,
} from '../../../application/contracts/security.js';
import { withTenantContext } from '../tenant-context.js';

export class PostgresPlatformRepository
  implements PlatformBootstrapRepository, UserRepository, AuthorizationRepository, SessionRepository, AuthenticationRepository, TenantBootstrapRepository
{
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey = 'app.current_tenant_id',
  ) {}

  async seedSubscriptionPlans(
    plans: Array<{ name: string; description?: string | null; priceMonthly: number; maxUsers?: number | null; maxStorageGb?: number | null; isActive?: boolean }>,
  ): Promise<void> {
    for (const plan of plans) {
      const existing = await this.pool.query('SELECT id FROM subscription_plans WHERE name = $1 LIMIT 1', [plan.name]);
      if (existing.rows.length > 0) {
        continue;
      }

      await this.pool.query(
        `INSERT INTO subscription_plans (id, name, description, price_monthly, max_users, max_storage_gb, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [uuidV7(), plan.name, plan.description ?? null, plan.priceMonthly, plan.maxUsers ?? null, plan.maxStorageGb ?? null, plan.isActive ?? true],
      );
    }
  }

  async seedModules(
    modules: Array<{ code: string; name: string; moduleGroup?: string; description?: string | null; icon?: string | null; route?: string | null; isCore?: boolean; sortOrder?: number; parentModuleCode?: string | null }>,
  ): Promise<void> {
    for (const module of modules) {
      const parentResult = module.parentModuleCode
        ? await this.pool.query('SELECT id FROM modules WHERE code = $1 LIMIT 1', [module.parentModuleCode])
        : null;
      const parentId = parentResult?.rows[0]?.id ?? null;

      const existing = await this.pool.query('SELECT id FROM modules WHERE code = $1 LIMIT 1', [module.code]);
      if (existing.rows.length > 0) {
        continue;
      }

      await this.pool.query(
        `INSERT INTO modules (id, parent_module_id, code, name, module_group, description, icon, route, is_core, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          uuidV7(),
          parentId,
          module.code,
          module.name,
          module.moduleGroup ?? 'Administration',
          module.description ?? null,
          module.icon ?? null,
          module.route ?? null,
          module.isCore ?? false,
          module.sortOrder ?? 0,
        ],
      );
    }
  }

  async seedPermissions(
    permissions: Array<{ moduleCode: string; resource: string; action: string; scope?: 'own' | 'branch' | 'organization' | 'tenant' | 'global'; permissionKey: string; displayName: string; description?: string | null; isSystem?: boolean }>,
  ): Promise<void> {
    for (const permission of permissions) {
      const existing = await this.pool.query('SELECT id FROM permissions WHERE permission_key = $1 LIMIT 1', [permission.permissionKey]);
      if (existing.rows.length > 0) {
        continue;
      }

      await this.pool.query(
        `INSERT INTO permissions (id, module_code, resource, action, scope, permission_key, display_name, description, is_system)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          uuidV7(),
          permission.moduleCode,
          permission.resource,
          permission.action,
          permission.scope ?? 'tenant',
          permission.permissionKey,
          permission.displayName,
          permission.description ?? null,
          permission.isSystem ?? false,
        ],
      );
    }
  }

  async findByTenantAndIdentifier(tenantId: string, identifier: string): Promise<({
    id: string;
    tenantId: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status: string;
  }) | null> {
    const normalizedIdentifier = identifier.trim();
    // Run the lookup under tenant context to satisfy RLS
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT id, tenant_id as "tenantId", organization_id as "organizationId", default_branch_id as "defaultBranchId",
                username, email, password_hash as "passwordHash", status
         FROM users
         WHERE tenant_id = $1 AND is_deleted = false AND (LOWER(username) = LOWER($2) OR LOWER(email) = LOWER($2))
         LIMIT 1`,
        [tenantId, normalizedIdentifier],
      );
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId ?? null,
      defaultBranchId: row.defaultBranchId ?? null,
      username: row.username,
      email: row.email,
      passwordHash: row.passwordHash,
      status: row.status,
    };
  }

  async findById(tenantId: string, userId: string): Promise<({
    id: string;
    tenantId: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status: string;
  }) | null> {
    // Ensure the query runs under tenant context to satisfy RLS policies
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT id, tenant_id as "tenantId", organization_id as "organizationId", default_branch_id as "defaultBranchId",
                username, email, password_hash as "passwordHash", status
         FROM users
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false
         LIMIT 1`,
        [tenantId, userId],
      );
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId ?? null,
      defaultBranchId: row.defaultBranchId ?? null,
      username: row.username,
      email: row.email,
      passwordHash: row.passwordHash,
      status: row.status,
    };
  }

  async getPermissionKeysForUser(tenantId: string, userId: string): Promise<UserPermissionRecord[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT DISTINCT permission_key, source
         FROM (
           SELECT p.permission_key, 'role' AS source
           FROM permissions p
           INNER JOIN role_permissions rp ON rp.permission_id = p.id AND rp.tenant_id = $1
           INNER JOIN user_roles ur ON ur.role_id = rp.role_id AND ur.tenant_id = $1 AND ur.user_id = $2
           INNER JOIN roles r ON r.id = ur.role_id AND r.tenant_id = $1 AND r.is_deleted = false
           INNER JOIN users u ON u.id = ur.user_id AND u.tenant_id = $1 AND u.is_deleted = false AND u.status = 'active'
           WHERE u.id = $2
           UNION ALL
           SELECT p.permission_key, 'direct' AS source
           FROM permissions p
           INNER JOIN user_permissions up ON up.permission_id = p.id AND up.tenant_id = $1 AND up.user_id = $2
           INNER JOIN users u ON u.id = up.user_id AND u.tenant_id = $1 AND u.is_deleted = false AND u.status = 'active'
           WHERE up.allow = true AND u.id = $2
         ) AS combined`,
        [tenantId, userId],
      );
    });

    return result.rows.map((row) => ({
      tenantId,
      userId,
      permissionKey: row.permission_key,
      source: row.source,
    }));
  }

  async listRoles(tenantId: string): Promise<Array<{ id: string; tenantId: string; code: string; name: string; description?: string | null; isSystem: boolean; sortOrder: number; createdAt?: Date | string | null; updatedAt?: Date | string | null }>> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT id, tenant_id as "tenantId", code, name, description, is_system as "isSystem", sort_order as "sortOrder", created_at as "createdAt", updated_at as "updatedAt"
         FROM roles WHERE tenant_id = $1 AND is_deleted = false ORDER BY sort_order, name`,
        [tenantId],
      );
    });

    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      name: row.name,
      description: row.description ?? null,
      isSystem: row.isSystem,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt ? new Date(row.createdAt) : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    }));
  }

  async getRoleById(tenantId: string, roleId: string): Promise<{ id: string; tenantId: string; code: string; name: string; description?: string | null; isSystem: boolean; sortOrder: number; createdAt?: Date | string | null; updatedAt?: Date | string | null } | null> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT id, tenant_id as "tenantId", code, name, description, is_system as "isSystem", sort_order as "sortOrder", created_at as "createdAt", updated_at as "updatedAt"
         FROM roles WHERE tenant_id = $1 AND id = $2 AND is_deleted = false LIMIT 1`,
        [tenantId, roleId],
      );
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      name: row.name,
      description: row.description ?? null,
      isSystem: row.isSystem,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt ? new Date(row.createdAt) : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  }

  async updateRole(tenantId: string, roleId: string, changes: { code?: string; name?: string; description?: string | null; isSystem?: boolean; sortOrder?: number }): Promise<{ id: string; tenantId: string; code: string; name: string; description?: string | null; isSystem: boolean; sortOrder: number; createdAt?: Date | string | null; updatedAt?: Date | string | null } | null> {
    const fields: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    if (changes.code !== undefined) {
      fields.push(`code = $${idx++}`);
      values.push(changes.code.trim());
    }
    if (changes.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(changes.name.trim());
    }
    if (changes.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(changes.description ?? null);
    }
    if (changes.isSystem !== undefined) {
      fields.push(`is_system = $${idx++}`);
      values.push(changes.isSystem);
    }
    if (changes.sortOrder !== undefined) {
      fields.push(`sort_order = $${idx++}`);
      values.push(changes.sortOrder);
    }

    if (fields.length === 1) {
      return this.getRoleById(tenantId, roleId);
    }

    values.push(tenantId, roleId);
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE roles SET ${fields.join(', ')} WHERE tenant_id = $${idx} AND id = $${idx + 1} AND is_deleted = false
         RETURNING id, tenant_id as "tenantId", code, name, description, is_system as "isSystem", sort_order as "sortOrder", created_at as "createdAt", updated_at as "updatedAt"`,
        values,
      );
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      name: row.name,
      description: row.description ?? null,
      isSystem: row.isSystem,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt ? new Date(row.createdAt) : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  }

  async listPermissions(tenantId: string): Promise<Array<{ id: string; moduleCode: string; resource: string; action: string; scope: 'own' | 'branch' | 'organization' | 'tenant' | 'global'; permissionKey: string; displayName: string; description?: string | null; isSystem: boolean }>> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT id, module_code as "moduleCode", resource, action, scope, permission_key as "permissionKey", display_name as "displayName", description, is_system as "isSystem"
         FROM permissions ORDER BY module_code, resource, action, permission_key`,
      );
    });

    return result.rows.map((row) => ({
      id: row.id,
      moduleCode: row.moduleCode,
      resource: row.resource,
      action: row.action,
      scope: row.scope,
      permissionKey: row.permissionKey,
      displayName: row.displayName,
      description: row.description ?? null,
      isSystem: row.isSystem,
    }));
  }

  async assignPermissionsToRole(tenantId: string, roleId: string, permissionKeys: string[]): Promise<number> {
    const normalized = Array.from(new Set(permissionKeys.filter(Boolean))).map((key) => key.trim());
    if (normalized.length === 0) {
      return 0;
    }

    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const permissionRows = await client.query(
        `SELECT id FROM permissions WHERE permission_key = ANY($1)`,
        [normalized],
      );
      if (permissionRows.rows.length === 0) {
        return { count: 0 };
      }

      const roleExists = await client.query(
        `SELECT 1 FROM roles WHERE tenant_id = $1 AND id = $2 AND is_deleted = false LIMIT 1`,
        [tenantId, roleId],
      );
      if (roleExists.rows.length === 0) {
        return { count: 0 };
      }

      const inserted: number[] = [];
      for (const permission of permissionRows.rows) {
        const insertResult = await client.query(
         `INSERT INTO role_permissions (tenant_id, role_id, permission_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (role_id, permission_id, tenant_id) DO NOTHING`,
         [tenantId, roleId, permission.id],
        );
        inserted.push(insertResult.rowCount ?? 0);
      }

      return { count: inserted.reduce((sum, current) => sum + current, 0) };
    });

    return result.count;
  }

  async removePermissionsFromRole(tenantId: string, roleId: string, permissionKeys: string[]): Promise<number> {
    const normalized = Array.from(new Set(permissionKeys.filter(Boolean))).map((key) => key.trim());
    if (normalized.length === 0) {
      return 0;
    }

    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const permissionRows = await client.query(
        `SELECT id FROM permissions WHERE permission_key = ANY($1)`,
        [normalized],
      );
      if (permissionRows.rows.length === 0) {
        return { count: 0 };
      }

      const ids = permissionRows.rows.map((row) => row.id);
      const deleteResult = await client.query(
        `DELETE FROM role_permissions
         WHERE tenant_id = $1 AND role_id = $2 AND permission_id = ANY($3)`,
        [tenantId, roleId, ids],
      );
      return { count: deleteResult.rowCount ?? 0 };
    });

    return result.count;
  }

  async assignRoleToUser(tenantId: string, userId: string, roleId: string): Promise<boolean> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const userRow = await client.query(
        `SELECT id FROM users WHERE tenant_id = $1 AND id = $2 AND is_deleted = false AND status = 'active' LIMIT 1`,
        [tenantId, userId],
      );
      if (userRow.rows.length === 0) {
        return false;
      }

      const roleRow = await client.query(
        `SELECT id FROM roles WHERE tenant_id = $1 AND id = $2 AND is_deleted = false LIMIT 1`,
        [tenantId, roleId],
      );
      if (roleRow.rows.length === 0) {
        return false;
      }

      const insertResult = await client.query(
        `INSERT INTO user_roles (tenant_id, user_id, role_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING`,
        [tenantId, userId, roleId],
      );

      return (insertResult.rowCount ?? 0) > 0;
    });

    return result;
  }

  async revokeRoleFromUser(tenantId: string, userId: string, roleId: string): Promise<boolean> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const deleteResult = await client.query(
        `DELETE FROM user_roles
         WHERE tenant_id = $1 AND user_id = $2 AND role_id = $3`,
        [tenantId, userId, roleId],
      );
      return (deleteResult.rowCount ?? 0) > 0;
    });

    return result;
  }

  async getUserEffectivePermissions(tenantId: string, userId: string): Promise<PermissionDescriptor[]> {
    const permissionKeys = await this.getPermissionKeysForUser(tenantId, userId);
    const permissionRecords = await this.listPermissions(tenantId);
    const lookup = new Map(permissionRecords.map((permission) => [permission.permissionKey, permission]));

    return permissionKeys
      .map((permission) => lookup.get(permission.permissionKey))
      .filter((permission): permission is PermissionDescriptor => Boolean(permission));
  }

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const id = input.id ?? uuidV7();
    // Run session creation under tenant context so RLS policies that use current_setting('app.current_tenant_id') work
    const result = await withTenantContext(this.pool, this.tenantContextKey, input.tenantId, async (client) => {
      return client.query(
        `INSERT INTO user_sessions (
           id, tenant_id, user_id, organization_id, branch_id, access_token_id, refresh_token_hash, device,
           user_agent, ip_address, location, is_active, revoked_at, revoked_by, termination_reason,
           login_at, last_activity_at, expires_at, logout_at, updated_at, version
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW(),$16,$17,NOW(),1)
         RETURNING id, tenant_id as "tenantId", user_id as "userId", organization_id as "organizationId", branch_id as "branchId",
                   access_token_id as "accessTokenId", is_active as "isActive", expires_at as "expiresAt",
                   login_at as "loginAt", last_activity_at as "lastActivityAt", revoked_at as "revokedAt", logout_at as "logoutAt"`,
        [
          id,
          input.tenantId,
          input.userId,
          input.organizationId ?? null,
          input.branchId ?? null,
          input.accessTokenId ?? null,
          input.refreshTokenHash,
          input.device ?? null,
          input.userAgent ?? null,
          input.ipAddress ?? null,
          null,
          true,
          null,
          null,
          null,
          input.expiresAt,
          null,
        ],
      );
    });

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      organizationId: row.organizationId,
      branchId: row.branchId,
      accessTokenId: row.accessTokenId,
      isActive: row.isActive,
      expiresAt: new Date(row.expiresAt),
      loginAt: new Date(row.loginAt),
      lastActivityAt: new Date(row.lastActivityAt),
      revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
      logoutAt: row.logoutAt ? new Date(row.logoutAt) : null,
    };
  }

  async findSession(sessionId: string, tenantId: string): Promise<SessionRecord | null> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT id, tenant_id as "tenantId", user_id as "userId", organization_id as "organizationId", branch_id as "branchId",
                access_token_id as "accessTokenId", is_active as "isActive", expires_at as "expiresAt",
                login_at as "loginAt", last_activity_at as "lastActivityAt", revoked_at as "revokedAt", logout_at as "logoutAt"
         FROM user_sessions
         WHERE id = $1 AND tenant_id = $2
         LIMIT 1`,
        [sessionId, tenantId],
      );
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      organizationId: row.organizationId,
      branchId: row.branchId,
      accessTokenId: row.accessTokenId,
      isActive: row.isActive,
      expiresAt: new Date(row.expiresAt),
      loginAt: new Date(row.loginAt),
      lastActivityAt: new Date(row.lastActivityAt),
      revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
      logoutAt: row.logoutAt ? new Date(row.logoutAt) : null,
    };
  }

  async findSessionByRefreshTokenHash(tenantId: string, refreshTokenHash: string): Promise<SessionRecord | null> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT id, tenant_id as "tenantId", user_id as "userId", organization_id as "organizationId", branch_id as "branchId",
                access_token_id as "accessTokenId", is_active as "isActive", expires_at as "expiresAt",
                login_at as "loginAt", last_activity_at as "lastActivityAt", revoked_at as "revokedAt", logout_at as "logoutAt"
         FROM user_sessions
         WHERE tenant_id = $1 AND refresh_token_hash = $2 AND is_active = true
         LIMIT 1`,
        [tenantId, refreshTokenHash],
      );
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      organizationId: row.organizationId,
      branchId: row.branchId,
      accessTokenId: row.accessTokenId,
      isActive: row.isActive,
      expiresAt: new Date(row.expiresAt),
      loginAt: new Date(row.loginAt),
      lastActivityAt: new Date(row.lastActivityAt),
      revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
      logoutAt: row.logoutAt ? new Date(row.logoutAt) : null,
    };
  }

  async invalidateSession(sessionId: string, tenantId: string): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE user_sessions
         SET is_active = false, revoked_at = NOW(), termination_reason = 'logout', logout_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [sessionId, tenantId],
      );
    });
  }

  async findRoleByTenantAndCode(tenantId: string, code: string): Promise<{ id: string; tenantId: string; code: string; name: string } | null> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        'SELECT id, tenant_id as "tenantId", code, name FROM roles WHERE tenant_id = $1 AND code = $2 AND is_deleted = false LIMIT 1',
        [tenantId, code],
      );
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      name: row.name,
    };
  }

  async createRole(
    tenantId: string,
    codeOrInput: string | { code: string; name: string; description?: string | null; isSystem?: boolean; sortOrder?: number },
    maybeName?: string,
  ): Promise<{ id: string; tenantId: string; code: string; name: string; description?: string | null; isSystem: boolean; sortOrder: number; createdAt?: Date | string | null; updatedAt?: Date | string | null }> {
    const input = typeof codeOrInput === 'string'
      ? { code: codeOrInput, name: maybeName ?? codeOrInput, description: null, isSystem: false, sortOrder: 0 }
      : codeOrInput;

    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `INSERT INTO roles (id, tenant_id, code, name, description, is_system, sort_order, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), 1)
         RETURNING id, tenant_id as "tenantId", code, name, description, is_system as "isSystem", sort_order as "sortOrder", created_at as "createdAt", updated_at as "updatedAt"`,
        [uuidV7(), tenantId, input.code.trim(), input.name.trim(), input.description ?? null, input.isSystem ?? false, input.sortOrder ?? 0],
      );
    });

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      name: row.name,
      description: row.description ?? null,
      isSystem: row.isSystem,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt ? new Date(row.createdAt) : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  }

  async createUser(input: {
    id?: string;
    tenantId: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status?: string;
  }): Promise<{ id: string; tenantId: string; organizationId?: string | null; defaultBranchId?: string | null; username: string; email: string; status: string }> {
    const id = input.id ?? uuidV7();
    const result = await withTenantContext(this.pool, this.tenantContextKey, input.tenantId, async (client) => {
      return client.query(
        `INSERT INTO users (id, tenant_id, organization_id, default_branch_id, username, email, password_hash, status, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), 1)
         RETURNING id, tenant_id as "tenantId", organization_id as "organizationId", default_branch_id as "defaultBranchId", username, email, status`,
        [id, input.tenantId, input.organizationId ?? null, input.defaultBranchId ?? null, input.username, input.email, input.passwordHash, input.status ?? 'active'],
      );
    });

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId ?? null,
      defaultBranchId: row.defaultBranchId ?? null,
      username: row.username,
      email: row.email,
      status: row.status,
    };
  }

  async assignUserRole(tenantId: string, userId: string, roleId: string): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      await client.query(
        `INSERT INTO user_roles (tenant_id, user_id, role_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING`,
        [tenantId, userId, roleId],
      );
    });
  }

  async bootstrapTenant(input: TenantBootstrapInput): Promise<TenantBootstrapResult> {
    const tenantId = input.tenant.id ?? uuidV7();
    const organizationId = input.organization.id ?? uuidV7();
    const branchId = input.branch.id ?? uuidV7();
    const userId = input.administrator.id ?? uuidV7();
    const roleId = input.role.id ?? uuidV7();

    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      // Wrapper for executing queries in this tenant transaction
      const logQuery = async (text: string, params: any[]) => {
        // intentionally minimal: execute the query on the transaction-scoped client
        return client.query(text, params);
      };
      const tenantResult = await logQuery(
        `INSERT INTO tenants (id, name, display_name, subdomain, slug, timezone, currency, locale, status, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), 1)
         RETURNING id`,
        [
          tenantId,
          input.tenant.name,
          input.tenant.displayName ?? input.tenant.name,
          input.tenant.subdomain,
          input.tenant.slug,
          input.tenant.timezone ?? 'UTC',
          input.tenant.currency ?? 'USD',
          input.tenant.locale ?? 'en_US',
          input.tenant.status ?? 'trial',
        ],
      );

      const insertedTenantId = tenantResult.rows[0]?.id ?? tenantId;

      await logQuery(
        `INSERT INTO organizations (id, tenant_id, code, name, legal_name, email, phone, website, base_currency, fiscal_calendar, status, is_default, remarks, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), 1)`,
        [
          organizationId,
          insertedTenantId,
          input.organization.code,
          input.organization.name,
          input.organization.legalName ?? null,
          input.organization.email ?? null,
          input.organization.phone ?? null,
          input.organization.website ?? null,
          input.organization.baseCurrency ?? 'USD',
          input.organization.fiscalCalendar ?? 'standard',
          input.organization.status ?? 'active',
          input.organization.isDefault ?? true,
          null,
        ],
      );

      await logQuery(
        `INSERT INTO branches (id, tenant_id, organization_id, code, name, status, is_head_office, is_default, city, country, timezone, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), 1)`,
        [
          branchId,
          insertedTenantId,
          organizationId,
          input.branch.code,
          input.branch.name,
          input.branch.status ?? 'active',
          input.branch.isHeadOffice ?? true,
          input.branch.isDefault ?? true,
          input.branch.city ?? null,
          input.branch.country ?? null,
          input.branch.timezone ?? 'UTC',
        ],
      );

      if (input.subscriptionPlanName) {
        const planResult = await logQuery('SELECT id FROM subscription_plans WHERE name = $1 LIMIT 1', [input.subscriptionPlanName]);
        const planId = planResult.rows[0]?.id;
        if (planId) {
          await logQuery(
            `INSERT INTO tenant_subscriptions (id, tenant_id, subscription_plan_id, status, starts_at, expires_at, created_at, updated_at, version)
             VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '365 days', NOW(), NOW(), 1)`,
            [uuidV7(), insertedTenantId, planId],
          );
        }
      }

      const moduleResult = await logQuery('SELECT id, code FROM modules WHERE code IN (\'core\', \'security\', \'organization\', \'branch\', \'user-management\', \'tenant-configuration\')', []);
      for (const moduleRow of moduleResult.rows) {
        await logQuery(
          `INSERT INTO tenant_modules (id, tenant_id, module_id, enabled, enabled_at, enabled_by, enabled_reason, disabled_at, disabled_by)
           VALUES ($1, $2, $3, true, NOW(), NULL, 'initial bootstrap', NULL, NULL)
           ON CONFLICT (tenant_id, module_id) DO NOTHING`,
          [uuidV7(), insertedTenantId, moduleRow.id],
        );
      }

      if (input.initialFinancialYear) {
        await logQuery(
          `INSERT INTO financial_years (id, tenant_id, organization_id, name, start_date, end_date, status, is_active, is_locked, remarks, created_at, updated_at, version)
           VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, false, 'bootstrapped', NOW(), NOW(), 1)`,
          [
            uuidV7(),
            insertedTenantId,
            organizationId,
            input.initialFinancialYear.name,
            input.initialFinancialYear.startDate,
            input.initialFinancialYear.endDate,
            input.initialFinancialYear.status ?? 'open',
            input.initialFinancialYear.isActive ?? true,
          ],
        );
      }

      const adminOrganizationId = input.administrator.organizationId ?? organizationId;
      const adminBranchId = input.administrator.defaultBranchId ?? branchId;
      const hashedPassword = input.administrator.password;

      await logQuery(
        `INSERT INTO users (id, tenant_id, organization_id, default_branch_id, username, email, password_hash, status, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW(), 1)`,
        [userId, insertedTenantId, adminOrganizationId, adminBranchId, input.administrator.username, input.administrator.email, hashedPassword],
      );

      await logQuery(
        `INSERT INTO roles (id, tenant_id, code, name, description, is_system, sort_order, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), NOW(), 1)`,
        [roleId, insertedTenantId, input.role.code, input.role.name, input.role.description ?? null, input.role.isSystem ?? false],
      );

      const permissionIds = await logQuery(
        `SELECT id FROM permissions WHERE permission_key = ANY($1) ORDER BY permission_key`,
        [input.permissions],
      );

      for (const permissionRow of permissionIds.rows) {
        await logQuery(
          `INSERT INTO role_permissions (tenant_id, role_id, permission_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (role_id, permission_id, tenant_id) DO NOTHING`,
          [insertedTenantId, roleId, permissionRow.id],
        );
      }

      await logQuery(
        `INSERT INTO user_roles (tenant_id, user_id, role_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING`,
        [insertedTenantId, userId, roleId],
      );

      await logQuery(
        `INSERT INTO user_organization_access (tenant_id, user_id, organization_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, organization_id, tenant_id) DO NOTHING`,
        [insertedTenantId, userId, adminOrganizationId],
      );

      await logQuery(
        `INSERT INTO user_branch_access (tenant_id, user_id, branch_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, branch_id, tenant_id) DO NOTHING`,
        [insertedTenantId, userId, adminBranchId],
      );

      const directPermissionIds = await logQuery(
        `SELECT id FROM permissions WHERE permission_key = ANY($1) ORDER BY permission_key`,
        [input.permissions],
      );
      for (const permissionRow of directPermissionIds.rows) {
        await client.query(
          `INSERT INTO user_permissions (tenant_id, user_id, permission_id, allow)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (user_id, permission_id, tenant_id) DO NOTHING`,
          [insertedTenantId, userId, permissionRow.id],
        );
      }

      return {
        tenantId: insertedTenantId,
        organizationId: adminOrganizationId,
        branchId: adminBranchId,
        userId,
        roleId,
      };
    });

    return result;
  }

  async updateUserStatus(tenantId: string, userId: string, status: string): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE users
         SET status = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [status, userId, tenantId],
      );
    });
  }

  async softDeleteUser(tenantId: string, userId: string): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE users
         SET is_deleted = true, deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [userId, tenantId],
      );
    });
  }
}

export type { SessionRepository };

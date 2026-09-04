import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import type { PermissionDescriptor, UserPermissionRecord } from '../../../domain/contracts/authorization.js';
import type { CreateSessionInput, SessionRecord } from '../../../domain/contracts/authentication.js';
import type { TenantBootstrapInput, TenantBootstrapResult } from '../../../domain/contracts/bootstrap.js';
import type {
  AuthenticationRepository,
  AuthorizationRepository,
  BranchRecord,
  CoreEnterpriseRepository,
  LocationRecord,
  OrganizationRecord,
  PlatformBootstrapRepository,
  SessionRepository,
  TenantBootstrapRepository,
  UserAdminRecord,
  UserBranchAccessRecord,
  UserOrganizationAccessRecord,
  UserRepository,
} from '../../../application/contracts/security.js';
import { withTenantContext } from '../tenant-context.js';

export class PostgresPlatformRepository
  implements
    PlatformBootstrapRepository,
    UserRepository,
    AuthorizationRepository,
    CoreEnterpriseRepository,
    SessionRepository,
    AuthenticationRepository,
    TenantBootstrapRepository
{
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey = 'app.current_tenant_id',
  ) {}

  private mapOrganizationRow(row: any): OrganizationRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      name: row.name,
      legalName: row.legalName ?? null,
      gstNo: row.gstNo ?? null,
      panNo: row.panNo ?? null,
      cinNo: row.cinNo ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      website: row.website ?? null,
      baseCurrency: row.baseCurrency ?? 'USD',
      fiscalCalendar: row.fiscalCalendar ?? 'standard',
      status: row.status,
      isDefault: row.isDefault ?? false,
      remarks: row.remarks ?? null,
      createdAt: row.createdAt ? new Date(row.createdAt) : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
      isDeleted: row.isDeleted ?? false,
    };
  }

  private mapBranchRow(row: any): BranchRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      code: row.code,
      name: row.name,
      status: row.status,
      isHeadOffice: row.isHeadOffice ?? false,
      isDefault: row.isDefault ?? false,
      addressLine1: row.addressLine1 ?? null,
      addressLine2: row.addressLine2 ?? null,
      city: row.city ?? null,
      district: row.district ?? null,
      state: row.state ?? null,
      country: row.country ?? null,
      postalCode: row.postalCode ?? null,
      timezone: row.timezone ?? 'UTC',
      remarks: row.remarks ?? null,
      createdAt: row.createdAt ? new Date(row.createdAt) : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
      isDeleted: row.isDeleted ?? false,
    };
  }

  private mapLocationRow(row: any): LocationRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      code: row.code,
      name: row.name,
      description: row.description ?? null,
      status: row.status,
      isDefault: row.isDefault ?? false,
      addressLine1: row.addressLine1 ?? null,
      addressLine2: row.addressLine2 ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      country: row.country ?? null,
      postalCode: row.postalCode ?? null,
      timezone: row.timezone ?? 'UTC',
      createdAt: row.createdAt ? new Date(row.createdAt) : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
      isDeleted: row.isDeleted ?? false,
    };
  }

  private mapUserAdminRow(row: any): UserAdminRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId ?? null,
      defaultBranchId: row.defaultBranchId ?? null,
      defaultLocationId: row.defaultLocationId ?? null,
      username: row.username,
      email: row.email,
      status: row.status,
      createdAt: row.createdAt ? new Date(row.createdAt) : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
      isDeleted: row.isDeleted ?? false,
    };
  }

  private async reserveNextCodeValue(
    tenantId: string,
    entityType: 'organization' | 'branch' | 'location',
    scopeKey: string,
  ): Promise<number> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return this.reserveNextCodeValueWithClient(client, tenantId, entityType, scopeKey);
    });

    return Number(result.rows[0]?.lastValue ?? 0);
  }

  private async reserveNextCodeValueWithClient(
    client: { query: (text: string, params?: any[]) => Promise<any> },
    tenantId: string,
    entityType: 'organization' | 'branch' | 'location',
    scopeKey: string,
  ): Promise<{ rows: Array<{ lastValue: number }> }> {
    return client.query(
      `INSERT INTO code_counters (tenant_id, entity_type, scope_key, last_value)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (tenant_id, entity_type, scope_key)
        DO UPDATE SET last_value = code_counters.last_value + 1
        RETURNING last_value AS "lastValue"`,
      [tenantId, entityType, scopeKey],
    );
  }

  async seedSubscriptionPlans(
    plans: Array<{
      name: string;
      description?: string | null;
      priceMonthly: number;
      maxUsers?: number | null;
      maxStorageGb?: number | null;
      isActive?: boolean;
    }>,
  ): Promise<void> {
    for (const plan of plans) {
      await this.pool.query(
        `INSERT INTO subscription_plans (id, name, description, price_monthly, max_users, max_storage_gb, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (name) DO NOTHING`,
        [
          uuidV7(),
          plan.name,
          plan.description ?? null,
          plan.priceMonthly,
          plan.maxUsers ?? null,
          plan.maxStorageGb ?? null,
          plan.isActive ?? true,
        ],
      );
    }
  }

  async seedModules(
    modules: Array<{
      code: string;
      name: string;
      moduleGroup?: string;
      description?: string | null;
      icon?: string | null;
      route?: string | null;
      isCore?: boolean;
      sortOrder?: number;
      parentModuleCode?: string | null;
    }>,
  ): Promise<void> {
    for (const module of modules) {
      const parentResult = module.parentModuleCode
        ? await this.pool.query('SELECT id FROM modules WHERE code = $1 LIMIT 1', [module.parentModuleCode])
        : null;
      const parentId = parentResult?.rows[0]?.id ?? null;

      await this.pool.query(
        `INSERT INTO modules (id, parent_module_id, code, name, module_group, description, icon, route, is_core, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (code) DO NOTHING`,
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
    permissions: Array<{
      moduleCode: string;
      resource: string;
      action: string;
      scope?: 'own' | 'branch' | 'organization' | 'tenant' | 'global';
      permissionKey: string;
      displayName: string;
      description?: string | null;
      isSystem?: boolean;
    }>,
  ): Promise<void> {
    for (const permission of permissions) {
      await this.pool.query(
        `INSERT INTO permissions (id, module_code, resource, action, scope, permission_key, display_name, description, is_system)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (permission_key) DO NOTHING`,
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

  async findByTenantAndIdentifier(
    tenantId: string,
    identifier: string,
  ): Promise<{
    id: string;
    tenantId: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
    defaultLocationId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status: string;
  } | null> {
    if (!tenantId || tenantId.trim() === '') {
      return null;
    }
    const normalizedIdentifier = identifier.trim();
    // Run the lookup under tenant context to satisfy RLS
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT id, tenant_id as "tenantId", organization_id as "organizationId", default_branch_id as "defaultBranchId", default_location_id as "defaultLocationId",
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
      defaultLocationId: row.defaultLocationId ?? null,
      username: row.username,
      email: row.email,
      passwordHash: row.passwordHash,
      status: row.status,
    };
  }

  async findById(
    tenantId: string,
    userId: string,
  ): Promise<{
    id: string;
    tenantId: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
    defaultLocationId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status: string;
    failedLoginCount?: number;
    lockedUntil?: Date | string | null;
  } | null> {
    if (!tenantId || tenantId.trim() === '' || !userId || userId.trim() === '') {
      return null;
    }
    // Ensure the query runs under tenant context to satisfy RLS policies
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT id, tenant_id as "tenantId", organization_id as "organizationId", default_branch_id as "defaultBranchId", default_location_id as "defaultLocationId",
                username, email, password_hash as "passwordHash", status, failed_login_count as "failedLoginCount", locked_until as "lockedUntil"
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
      defaultLocationId: row.defaultLocationId ?? null,
      username: row.username,
      email: row.email,
      passwordHash: row.passwordHash,
      status: row.status,
      failedLoginCount: row.failedLoginCount ?? 0,
      lockedUntil: row.lockedUntil ? new Date(row.lockedUntil) : null,
    };
  }

  async recordFailedLoginAttempt(
    tenantId: string,
    userId: string,
    options: { maxFailedAttempts?: number; lockoutMinutes?: number } = {},
  ): Promise<{ failedLoginCount: number; lockedUntil: Date | null }> {
    const maxFailedAttempts = options.maxFailedAttempts ?? 5;
    const lockoutMinutes = options.lockoutMinutes ?? 15;

    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE users
         SET failed_login_count = failed_login_count + 1,
             locked_until = CASE
               WHEN failed_login_count + 1 >= $3 THEN NOW() + ($4 * INTERVAL '1 minute')
               ELSE NULL
             END,
             updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false
         RETURNING failed_login_count as "failedLoginCount", locked_until as "lockedUntil"`,
        [tenantId, userId, maxFailedAttempts, lockoutMinutes],
      );
    });

    if (result.rows.length === 0) {
      return { failedLoginCount: 0, lockedUntil: null };
    }

    const row = result.rows[0];
    return {
      failedLoginCount: Number(row.failedLoginCount ?? 0),
      lockedUntil: row.lockedUntil ? new Date(row.lockedUntil) : null,
    };
  }

  async resetFailedLoginState(tenantId: string, userId: string): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      await client.query(
        `UPDATE users
         SET failed_login_count = 0,
             locked_until = NULL,
             updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false`,
        [tenantId, userId],
      );
    });
  }

  async getTenantById(tenantId: string): Promise<{
    id: string;
    name: string;
    displayName?: string | null;
    subdomain: string;
    slug: string;
    status: string;
  } | null> {
    const result = await this.pool.query(
      `SELECT id, name, display_name as "displayName", subdomain, slug, status
       FROM tenants WHERE id = $1 AND is_deleted = false LIMIT 1`,
      [tenantId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      displayName: row.displayName ?? null,
      subdomain: row.subdomain,
      slug: row.slug,
      status: row.status,
    };
  }

  async findTenantByHost(host: string): Promise<{
    id: string;
    name: string;
    displayName?: string | null;
    subdomain: string;
    slug: string;
    status: string;
  } | null> {
    const normalizedHost = (host ?? '')
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, '')
      .replace(/^www\./, '');
    if (!normalizedHost) {
      return null;
    }

    const hostCandidates = new Set<string>([normalizedHost]);
    const labels = normalizedHost.split('.');
    if (labels.length > 1) {
      hostCandidates.add(labels[0]);
    }
    const candidates = [...hostCandidates].filter(Boolean);
    const query = `
      SELECT id, name, display_name as "displayName", subdomain, slug, status
      FROM tenants
      WHERE is_deleted = false
        AND (
          LOWER(subdomain) = ANY($1)
          OR LOWER(slug) = ANY($1)
        )
      LIMIT 1
    `;

    const result = await this.pool.query(query, [candidates]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      displayName: row.displayName ?? null,
      subdomain: row.subdomain,
      slug: row.slug,
      status: row.status,
    };
  }

  async findUserOrganizationMemberships(
    tenantId: string,
    userId: string,
  ): Promise<
    Array<{
      id: string;
      tenantId: string;
      code: string;
      name: string;
      status: 'active' | 'inactive' | 'archived';
      isDefault: boolean;
    }>
  > {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT o.id, o.tenant_id as "tenantId", o.code, o.name, o.status, o.is_default as "isDefault"
         FROM user_organization_access uoa
         INNER JOIN organizations o ON o.id = uoa.organization_id AND o.tenant_id = uoa.tenant_id
         WHERE uoa.tenant_id = $1 AND uoa.user_id = $2 AND o.is_deleted = false
         ORDER BY o.name ASC`,
        [tenantId, userId],
      );
    });

    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      name: row.name,
      status: row.status,
      isDefault: row.isDefault,
    }));
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

  async listRoles(tenantId: string): Promise<
    Array<{
      id: string;
      tenantId: string;
      code: string;
      name: string;
      description?: string | null;
      isSystem: boolean;
      sortOrder: number;
      createdAt?: Date | string | null;
      updatedAt?: Date | string | null;
    }>
  > {
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

  async getRoleById(
    tenantId: string,
    roleId: string,
  ): Promise<{
    id: string;
    tenantId: string;
    code: string;
    name: string;
    description?: string | null;
    isSystem: boolean;
    sortOrder: number;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
  } | null> {
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

  async updateRole(
    tenantId: string,
    roleId: string,
    changes: { code?: string; name?: string; description?: string | null; isSystem?: boolean; sortOrder?: number },
  ): Promise<{
    id: string;
    tenantId: string;
    code: string;
    name: string;
    description?: string | null;
    isSystem: boolean;
    sortOrder: number;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
  } | null> {
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

  async listPermissions(tenantId: string): Promise<
    Array<{
      id: string;
      moduleCode: string;
      resource: string;
      action: string;
      scope: 'own' | 'branch' | 'organization' | 'tenant' | 'global';
      permissionKey: string;
      displayName: string;
      description?: string | null;
      isSystem: boolean;
    }>
  > {
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
      const permissionRows = await client.query(`SELECT id FROM permissions WHERE permission_key = ANY($1)`, [
        normalized,
      ]);
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
      const permissionRows = await client.query(`SELECT id FROM permissions WHERE permission_key = ANY($1)`, [
        normalized,
      ]);
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

  async replacePermissionsForRole(tenantId: string, roleId: string, permissionKeys: string[]): Promise<number> {
    const normalized = Array.from(new Set((permissionKeys ?? []).filter(Boolean)))
      .map((key) => key.trim())
      .filter(Boolean);
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const roleExists = await client.query(
        `SELECT 1 FROM roles WHERE tenant_id = $1 AND id = $2 AND is_deleted = false LIMIT 1`,
        [tenantId, roleId],
      );
      if (roleExists.rows.length === 0) {
        return { count: 0, roleFound: false };
      }

      const permissionRows = await client.query(
        `SELECT id, permission_key as "permissionKey" FROM permissions WHERE permission_key = ANY($1)`,
        [normalized],
      );
      const validKeys = new Set(permissionRows.rows.map((row) => row.permissionKey));
      const invalidKeys = normalized.filter((key) => !validKeys.has(key));
      if (invalidKeys.length > 0) {
        throw new Error(`Unknown permission key(s): ${invalidKeys.join(', ')}`);
      }

      await client.query(`DELETE FROM role_permissions WHERE tenant_id = $1 AND role_id = $2`, [tenantId, roleId]);

      const permissionIds = permissionRows.rows.map((row) => row.id);
      if (permissionIds.length === 0) {
        return { count: 0, roleFound: true };
      }

      let inserted = 0;
      for (const permissionId of permissionIds) {
        const insertResult = await client.query(
          `INSERT INTO role_permissions (tenant_id, role_id, permission_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (role_id, permission_id, tenant_id) DO NOTHING`,
          [tenantId, roleId, permissionId],
        );
        inserted += insertResult.rowCount ?? 0;
      }

      return { count: inserted, roleFound: true };
    });

    if (!result.roleFound) {
      return 0;
    }

    return result.count;
  }

  async getPermissionsForRole(tenantId: string, roleId: string): Promise<PermissionDescriptor[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const rows = await client.query(
        `SELECT p.id, p.module_code as "moduleCode", p.resource, p.action, p.scope, p.permission_key as "permissionKey",
                p.display_name as "displayName", p.description, p.is_system as "isSystem"
         FROM permissions p
         INNER JOIN role_permissions rp ON rp.permission_id = p.id AND rp.tenant_id = $1
         WHERE rp.role_id = $2
         ORDER BY p.module_code, p.resource, p.action, p.permission_key`,
        [tenantId, roleId],
      );

      return rows.rows.map((row: any) => ({
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
    });

    return result;
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

      await client.query(
        `INSERT INTO user_roles (tenant_id, user_id, role_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING`,
        [tenantId, userId, roleId],
      );

      return true;
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

  async getRolesForUser(
    tenantId: string,
    userId: string,
  ): Promise<
    Array<{
      id: string;
      tenantId: string;
      code: string;
      name: string;
      description?: string | null;
      isSystem: boolean;
      sortOrder: number;
      createdAt?: Date | string | null;
      updatedAt?: Date | string | null;
    }>
  > {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT r.id, r.tenant_id as "tenantId", r.code, r.name, r.description,
                r.is_system as "isSystem", r.sort_order as "sortOrder",
                r.created_at as "createdAt", r.updated_at as "updatedAt"
         FROM user_roles ur
         INNER JOIN roles r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
         INNER JOIN users u ON u.id = ur.user_id AND u.tenant_id = ur.tenant_id
         WHERE ur.tenant_id = $1 AND ur.user_id = $2
           AND u.is_deleted = false AND u.status = 'active' AND r.is_deleted = false
         ORDER BY r.sort_order, r.name`,
        [tenantId, userId],
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
           id, tenant_id, user_id, organization_id, location_id, branch_id, access_token_id, refresh_token_hash, device,
           user_agent, ip_address, location, is_active, revoked_at, revoked_by, termination_reason,
           login_at, last_activity_at, expires_at, logout_at, updated_at, version
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW(),$17,$18,NOW(),1)
         RETURNING id, tenant_id as "tenantId", user_id as "userId", organization_id as "organizationId", location_id as "locationId",
                   branch_id as "branchId", access_token_id as "accessTokenId", is_active as "isActive", expires_at as "expiresAt",
                   login_at as "loginAt", last_activity_at as "lastActivityAt", revoked_at as "revokedAt", logout_at as "logoutAt"`,
        [
          id,
          input.tenantId,
          input.userId,
          input.organizationId ?? null,
          input.locationId ?? null,
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
      locationId: row.locationId ?? null,
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
        `SELECT id, tenant_id as "tenantId", user_id as "userId", organization_id as "organizationId", location_id as "locationId", branch_id as "branchId",
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
      locationId: row.locationId ?? null,
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
        `SELECT id, tenant_id as "tenantId", user_id as "userId", organization_id as "organizationId", location_id as "locationId", branch_id as "branchId",
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
      locationId: row.locationId ?? null,
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

  async findRoleByTenantAndCode(
    tenantId: string,
    code: string,
  ): Promise<{ id: string; tenantId: string; code: string; name: string } | null> {
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
    codeOrInput:
      | string
      | { code: string; name: string; description?: string | null; isSystem?: boolean; sortOrder?: number },
    maybeName?: string,
  ): Promise<{
    id: string;
    tenantId: string;
    code: string;
    name: string;
    description?: string | null;
    isSystem: boolean;
    sortOrder: number;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
  }> {
    const input =
      typeof codeOrInput === 'string'
        ? { code: codeOrInput, name: maybeName ?? codeOrInput, description: null, isSystem: false, sortOrder: 0 }
        : codeOrInput;

    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `INSERT INTO roles (id, tenant_id, code, name, description, is_system, sort_order, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), 1)
         RETURNING id, tenant_id as "tenantId", code, name, description, is_system as "isSystem", sort_order as "sortOrder", created_at as "createdAt", updated_at as "updatedAt"`,
        [
          uuidV7(),
          tenantId,
          input.code.trim(),
          input.name.trim(),
          input.description ?? null,
          input.isSystem ?? false,
          input.sortOrder ?? 0,
        ],
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
    defaultLocationId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status?: string;
  }): Promise<{
    id: string;
    tenantId: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
    defaultLocationId?: string | null;
    username: string;
    email: string;
    status: string;
  }> {
    const id = input.id ?? uuidV7();
    const result = await withTenantContext(this.pool, this.tenantContextKey, input.tenantId, async (client) => {
      const userResult = await client.query(
        `INSERT INTO users (id, tenant_id, organization_id, default_branch_id, default_location_id, username, email, password_hash, status, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), 1)
         RETURNING id, tenant_id as "tenantId", organization_id as "organizationId", default_branch_id as "defaultBranchId", default_location_id as "defaultLocationId", username, email, status`,
        [
          id,
          input.tenantId,
          input.organizationId ?? null,
          input.defaultBranchId ?? null,
          input.defaultLocationId ?? null,
          input.username,
          input.email,
          input.passwordHash,
          input.status ?? 'active',
        ],
      );

      if (input.organizationId) {
        await client.query(
          `INSERT INTO user_organization_access (tenant_id, user_id, organization_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, organization_id, tenant_id) DO NOTHING`,
          [input.tenantId, id, input.organizationId],
        );
      }

      if (input.defaultBranchId) {
        await client.query(
          `INSERT INTO user_branch_access (tenant_id, user_id, branch_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, branch_id, tenant_id) DO NOTHING`,
          [input.tenantId, id, input.defaultBranchId],
        );
      }

      if (input.defaultLocationId) {
        await client.query(
          `INSERT INTO user_location_access (tenant_id, user_id, organization_id, location_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, location_id, tenant_id) DO NOTHING`,
          [input.tenantId, id, input.organizationId, input.defaultLocationId],
        );
      }

      return userResult;
    });

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId ?? null,
      defaultBranchId: row.defaultBranchId ?? null,
      defaultLocationId: row.defaultLocationId ?? null,
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
      const organizationCodeResult = await this.reserveNextCodeValueWithClient(
        client,
        insertedTenantId,
        'organization',
        'tenant',
      );
      const branchCodeResult = await this.reserveNextCodeValueWithClient(client, insertedTenantId, 'branch', 'tenant');

      const organizationNumber = Number(organizationCodeResult.rows[0]?.lastValue ?? 0);
      const branchNumber = Number(branchCodeResult.rows[0]?.lastValue ?? 0);

      await logQuery(
        `INSERT INTO organizations (id, tenant_id, code, name, legal_name, email, phone, website, base_currency, fiscal_calendar, status, is_default, remarks, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), 1)`,
        [
          organizationId,
          insertedTenantId,
          `ORG${String(organizationNumber).padStart(6, '0')}`,
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

      const coreModuleRows = await logQuery('SELECT id, code FROM modules WHERE is_core = true', []);
      for (const moduleRow of coreModuleRows.rows) {
        await logQuery(
          `INSERT INTO tenant_modules (id, tenant_id, module_id, enabled, enabled_at, enabled_by, enabled_reason, disabled_at, disabled_by)
           VALUES ($1, $2, $3, true, NOW(), NULL, 'bootstrap', NULL, NULL)
           ON CONFLICT (tenant_id, module_id) DO NOTHING`,
          [uuidV7(), insertedTenantId, moduleRow.id],
        );
        await logQuery(
          `INSERT INTO organization_modules (id, tenant_id, organization_id, module_id, enabled, enabled_at, enabled_by, disabled_at, disabled_by)
           VALUES ($1, $2, $3, $4, true, NOW(), NULL, NULL, NULL)
           ON CONFLICT (organization_id, module_id) DO NOTHING`,
          [uuidV7(), insertedTenantId, organizationId, moduleRow.id],
        );
      }

      await logQuery(
        `INSERT INTO branches (id, tenant_id, organization_id, code, name, status, is_head_office, is_default, city, country, timezone, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), 1)`,
        [
          branchId,
          insertedTenantId,
          organizationId,
          `BR${String(branchNumber).padStart(3, '0')}`,
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
        const planResult = await logQuery('SELECT id FROM subscription_plans WHERE name = $1 LIMIT 1', [
          input.subscriptionPlanName,
        ]);
        const planId = planResult.rows[0]?.id;
        if (planId) {
          await logQuery(
            `INSERT INTO tenant_subscriptions (id, tenant_id, subscription_plan_id, status, starts_at, expires_at, created_at, updated_at, version)
             VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '365 days', NOW(), NOW(), 1)`,
            [uuidV7(), insertedTenantId, planId],
          );
        }
      }

      const moduleResult = await logQuery(
        "SELECT id, code FROM modules WHERE code IN ('core', 'security', 'organization', 'branch', 'user-management', 'tenant-configuration')",
        [],
      );
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
        [
          userId,
          insertedTenantId,
          adminOrganizationId,
          adminBranchId,
          input.administrator.username,
          input.administrator.email,
          hashedPassword,
        ],
      );

      await logQuery(
        `INSERT INTO roles (id, tenant_id, code, name, description, is_system, sort_order, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), NOW(), 1)`,
        [
          roleId,
          insertedTenantId,
          input.role.code,
          input.role.name,
          input.role.description ?? null,
          input.role.isSystem ?? false,
        ],
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

  private async generateOrganizationCodeWithClient(
    client: { query: (text: string, params?: any[]) => Promise<any> },
    tenantId: string,
  ): Promise<string> {
    const result = await this.reserveNextCodeValueWithClient(client, tenantId, 'organization', 'tenant');
    const nextNumber = Number(result.rows[0]?.lastValue ?? 0);
    return `ORG${String(nextNumber).padStart(6, '0')}`;
  }

  async generateOrganizationCode(tenantId: string): Promise<string> {
    const nextNumber = await this.reserveNextCodeValue(tenantId, 'organization', 'tenant');
    return `ORG${String(nextNumber).padStart(6, '0')}`;
  }

  async createOrganization(
    tenantId: string,
    input: {
      code?: string | null;
      name: string;
      legalName?: string | null;
      gstNo?: string | null;
      panNo?: string | null;
      cinNo?: string | null;
      email?: string | null;
      phone?: string | null;
      website?: string | null;
      baseCurrency?: string;
      fiscalCalendar?: string;
      status?: 'active' | 'inactive' | 'archived';
      isDefault?: boolean;
      remarks?: string | null;
    },
  ): Promise<OrganizationRecord> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const nextCode = await this.generateOrganizationCodeWithClient(client, tenantId);

      return client.query(
        `INSERT INTO organizations (
         id, tenant_id, code, name, legal_name, gst_no, pan_no, cin_no, email, phone, website,
         base_currency, fiscal_calendar, status, is_default, remarks, created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW(), 1)
        RETURNING
         id,
         tenant_id as "tenantId",
         code,
         name,
         legal_name as "legalName",
         gst_no as "gstNo",
         pan_no as "panNo",
         cin_no as "cinNo",
         email,
         phone,
         website,
         base_currency as "baseCurrency",
         fiscal_calendar as "fiscalCalendar",
         status,
         is_default as "isDefault",
         remarks,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"`,
        [
          uuidV7(),
          tenantId,
          nextCode,
          input.name.trim(),
          input.legalName ?? null,
          input.gstNo ?? null,
          input.panNo ?? null,
          input.cinNo ?? null,
          input.email ?? null,
          input.phone ?? null,
          input.website ?? null,
          input.baseCurrency ?? 'USD',
          input.fiscalCalendar ?? 'standard',
          input.status ?? 'active',
          input.isDefault ?? false,
          input.remarks ?? null,
        ],
      );
    });

    return this.mapOrganizationRow(result.rows[0]);
  }

  async listOrganizations(tenantId: string): Promise<OrganizationRecord[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT
         id,
         tenant_id as "tenantId",
         code,
         name,
         legal_name as "legalName",
         gst_no as "gstNo",
         pan_no as "panNo",
         cin_no as "cinNo",
         email,
         phone,
         website,
         base_currency as "baseCurrency",
         fiscal_calendar as "fiscalCalendar",
         status,
         is_default as "isDefault",
         remarks,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"
         FROM organizations
         WHERE tenant_id = $1 AND is_deleted = false AND status = 'active'
         ORDER BY name`,
        [tenantId],
      );
    });

    return result.rows.map((row) => this.mapOrganizationRow(row));
  }

  async getOrganizationById(tenantId: string, organizationId: string): Promise<OrganizationRecord | null> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT
         id,
         tenant_id as "tenantId",
         code,
         name,
         legal_name as "legalName",
         gst_no as "gstNo",
         pan_no as "panNo",
         cin_no as "cinNo",
         email,
         phone,
         website,
         base_currency as "baseCurrency",
         fiscal_calendar as "fiscalCalendar",
         status,
         is_default as "isDefault",
         remarks,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"
         FROM organizations
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false AND status = 'active'
         LIMIT 1`,
        [tenantId, organizationId],
      );
    });

    return result.rows.length > 0 ? this.mapOrganizationRow(result.rows[0]) : null;
  }

  async updateOrganization(
    tenantId: string,
    organizationId: string,
    changes: Partial<
      Pick<
        OrganizationRecord,
        | 'code'
        | 'name'
        | 'legalName'
        | 'gstNo'
        | 'panNo'
        | 'cinNo'
        | 'email'
        | 'phone'
        | 'website'
        | 'baseCurrency'
        | 'fiscalCalendar'
        | 'status'
        | 'isDefault'
        | 'remarks'
      >
    >,
  ): Promise<OrganizationRecord | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (changes.code !== undefined) {
      throw new Error('Organization code is generated server-side and cannot be modified.');
    }
    if (changes.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(String(changes.name).trim());
    }
    if (changes.legalName !== undefined) {
      fields.push(`legal_name = $${idx++}`);
      values.push(changes.legalName ?? null);
    }
    if (changes.gstNo !== undefined) {
      fields.push(`gst_no = $${idx++}`);
      values.push(changes.gstNo ?? null);
    }
    if (changes.panNo !== undefined) {
      fields.push(`pan_no = $${idx++}`);
      values.push(changes.panNo ?? null);
    }
    if (changes.cinNo !== undefined) {
      fields.push(`cin_no = $${idx++}`);
      values.push(changes.cinNo ?? null);
    }
    if (changes.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(changes.email ?? null);
    }
    if (changes.phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(changes.phone ?? null);
    }
    if (changes.website !== undefined) {
      fields.push(`website = $${idx++}`);
      values.push(changes.website ?? null);
    }
    if (changes.baseCurrency !== undefined) {
      fields.push(`base_currency = $${idx++}`);
      values.push(changes.baseCurrency ?? 'USD');
    }
    if (changes.fiscalCalendar !== undefined) {
      fields.push(`fiscal_calendar = $${idx++}`);
      values.push(changes.fiscalCalendar ?? 'standard');
    }
    if (changes.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(changes.status ?? 'active');
    }
    if (changes.isDefault !== undefined) {
      fields.push(`is_default = $${idx++}`);
      values.push(changes.isDefault ?? false);
    }
    if (changes.remarks !== undefined) {
      fields.push(`remarks = $${idx++}`);
      values.push(changes.remarks ?? null);
    }

    if (fields.length === 0) {
      return this.getOrganizationById(tenantId, organizationId);
    }

    values.push(tenantId, organizationId);
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE organizations
         SET ${fields.join(', ')}, updated_at = NOW()
         WHERE tenant_id = $${idx} AND id = $${idx + 1} AND is_deleted = false
         RETURNING
         id,
         tenant_id as "tenantId",
         code,
         name,
         legal_name as "legalName",
         gst_no as "gstNo",
         pan_no as "panNo",
         cin_no as "cinNo",
         email,
         phone,
         website,
         base_currency as "baseCurrency",
         fiscal_calendar as "fiscalCalendar",
         status,
         is_default as "isDefault",
         remarks,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"`,
        values,
      );
    });

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapOrganizationRow(result.rows[0]);
  }

  async deactivateOrganization(tenantId: string, organizationId: string): Promise<boolean> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE organizations
         SET status = 'inactive', is_deleted = true, deleted_at = NOW(), updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false
         RETURNING id`,
        [tenantId, organizationId],
      );
    });

    return (result.rowCount ?? 0) > 0;
  }

  private async generateBranchCodeWithClient(
    client: { query: (text: string, params?: any[]) => Promise<any> },
    tenantId: string,
    organizationId: string,
  ): Promise<string> {
    void organizationId;
    const result = await this.reserveNextCodeValueWithClient(client, tenantId, 'branch', 'tenant');
    const nextNumber = Number(result.rows[0]?.lastValue ?? 0);
    return `BR${String(nextNumber).padStart(3, '0')}`;
  }

  async generateBranchCode(tenantId: string, organizationId: string): Promise<string> {
    void organizationId;
    const nextNumber = await this.reserveNextCodeValue(tenantId, 'branch', 'tenant');
    return `BR${String(nextNumber).padStart(3, '0')}`;
  }

  async createBranch(
    tenantId: string,
    organizationId: string,
    input: {
      code?: string | null;
      name: string;
      status?: 'active' | 'inactive' | 'archived';
      isHeadOffice?: boolean;
      isDefault?: boolean;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      district?: string | null;
      state?: string | null;
      country?: string | null;
      postalCode?: string | null;
      timezone?: string;
      remarks?: string | null;
    },
  ): Promise<BranchRecord> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const organization = await client.query(
        `SELECT id FROM organizations WHERE tenant_id = $1 AND id = $2 AND is_deleted = false AND status = 'active' LIMIT 1`,
        [tenantId, organizationId],
      );
      if (organization.rows.length === 0) {
        throw new Error('Organization not found or inactive.');
      }

      const nextCode = await this.generateBranchCodeWithClient(client, tenantId, organizationId);

      return client.query(
        `INSERT INTO branches (
         id, tenant_id, organization_id, code, name, status, is_head_office, is_default, address_line1, address_line2, city,
         district, state, country, postal_code, timezone, remarks, created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW(), 1)
        RETURNING
         id,
         tenant_id as "tenantId",
         organization_id as "organizationId",
         code,
         name,
         status,
         is_head_office as "isHeadOffice",
         is_default as "isDefault",
         address_line1 as "addressLine1",
         address_line2 as "addressLine2",
         city,
         district,
         state,
         country,
         postal_code as "postalCode",
         timezone,
         remarks,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"`,
        [
          uuidV7(),
          tenantId,
          organizationId,
          nextCode,
          input.name.trim(),
          input.status ?? 'active',
          input.isHeadOffice ?? false,
          input.isDefault ?? false,
          input.addressLine1 ?? null,
          input.addressLine2 ?? null,
          input.city ?? null,
          input.district ?? null,
          input.state ?? null,
          input.country ?? null,
          input.postalCode ?? null,
          input.timezone ?? 'UTC',
          input.remarks ?? null,
        ],
      );
    });

    return this.mapBranchRow(result.rows[0]);
  }

  async listBranches(tenantId: string, organizationId: string): Promise<BranchRecord[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT
         id,
         tenant_id as "tenantId",
         organization_id as "organizationId",
         code,
         name,
         status,
         is_head_office as "isHeadOffice",
         is_default as "isDefault",
         address_line1 as "addressLine1",
         address_line2 as "addressLine2",
         city,
         district,
         state,
         country,
         postal_code as "postalCode",
         timezone,
         remarks,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"
         FROM branches
         WHERE tenant_id = $1 AND organization_id = $2 AND is_deleted = false AND status = 'active'
         ORDER BY name`,
        [tenantId, organizationId],
      );
    });

    return result.rows.map((row) => this.mapBranchRow(row));
  }

  async listAccessibleBranchesForUser(
    tenantId: string,
    userId: string,
    organizationId?: string | null,
  ): Promise<BranchRecord[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT b.id,
               b.tenant_id as "tenantId",
               b.organization_id as "organizationId",
               b.code,
               b.name,
               b.status,
               b.is_head_office as "isHeadOffice",
               b.is_default as "isDefault",
               b.address_line1 as "addressLine1",
               b.address_line2 as "addressLine2",
               b.city,
               b.district,
               b.state,
               b.country,
               b.postal_code as "postalCode",
               b.timezone,
               b.remarks,
               b.created_at as "createdAt",
               b.updated_at as "updatedAt",
               b.deleted_at as "deletedAt",
               b.is_deleted as "isDeleted"
         FROM branches b
         WHERE b.tenant_id = $1
           AND b.is_deleted = false
           AND b.status = 'active'
           AND EXISTS (
             SELECT 1
             FROM user_branch_access uba
             WHERE uba.tenant_id = b.tenant_id
               AND uba.branch_id = b.id
               AND uba.user_id = $2
           )
           AND ($3::uuid IS NULL OR b.organization_id = $3)
         ORDER BY b.name`,
        [tenantId, userId, organizationId ?? null],
      );
    });

    return result.rows.map((row) => this.mapBranchRow(row));
  }

  async getBranchById(tenantId: string, organizationId: string, branchId: string): Promise<BranchRecord | null> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT
         id,
         tenant_id as "tenantId",
         organization_id as "organizationId",
         code,
         name,
         status,
         is_head_office as "isHeadOffice",
         is_default as "isDefault",
         address_line1 as "addressLine1",
         address_line2 as "addressLine2",
         city,
         district,
         state,
         country,
         postal_code as "postalCode",
         timezone,
         remarks,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"
         FROM branches
         WHERE tenant_id = $1 AND organization_id = $2 AND id = $3 AND is_deleted = false AND status = 'active'
         LIMIT 1`,
        [tenantId, organizationId, branchId],
      );
    });

    return result.rows.length > 0 ? this.mapBranchRow(result.rows[0]) : null;
  }

  async getAccessibleBranchByIdForUser(
    tenantId: string,
    userId: string,
    branchId: string,
    organizationId?: string | null,
  ): Promise<BranchRecord | null> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT b.id,
               b.tenant_id as "tenantId",
               b.organization_id as "organizationId",
               b.code,
               b.name,
               b.status,
               b.is_head_office as "isHeadOffice",
               b.is_default as "isDefault",
               b.address_line1 as "addressLine1",
               b.address_line2 as "addressLine2",
               b.city,
               b.district,
               b.state,
               b.country,
               b.postal_code as "postalCode",
               b.timezone,
               b.remarks,
               b.created_at as "createdAt",
               b.updated_at as "updatedAt",
               b.deleted_at as "deletedAt",
               b.is_deleted as "isDeleted"
         FROM branches b
         WHERE b.tenant_id = $1
           AND b.id = $2
           AND b.is_deleted = false
           AND b.status = 'active'
           AND EXISTS (
             SELECT 1
             FROM user_branch_access uba
             WHERE uba.tenant_id = b.tenant_id
               AND uba.branch_id = b.id
               AND uba.user_id = $3
           )
           AND ($4::uuid IS NULL OR b.organization_id = $4)
         LIMIT 1`,
        [tenantId, branchId, userId, organizationId ?? null],
      );
    });

    return result.rows.length > 0 ? this.mapBranchRow(result.rows[0]) : null;
  }

  async validateBranchAccess(
    tenantId: string,
    userId: string,
    branchId: string,
    organizationId?: string | null,
  ): Promise<boolean> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT 1
         FROM user_branch_access uba
         WHERE uba.tenant_id = $1
           AND uba.user_id = $2
           AND uba.branch_id = $3
           AND ($4::uuid IS NULL OR EXISTS (
             SELECT 1
             FROM branches b
             WHERE b.tenant_id = uba.tenant_id
               AND b.id = uba.branch_id
               AND b.organization_id = $4
               AND b.is_deleted = false
               AND b.status = 'active'
           ))
         LIMIT 1`,
        [tenantId, userId, branchId, organizationId ?? null],
      );
    });

    return (result.rowCount ?? 0) > 0;
  }

  async updateBranch(
    tenantId: string,
    organizationId: string,
    branchId: string,
    changes: Partial<
      Pick<
        BranchRecord,
        | 'code'
        | 'name'
        | 'status'
        | 'isHeadOffice'
        | 'isDefault'
        | 'addressLine1'
        | 'addressLine2'
        | 'city'
        | 'district'
        | 'state'
        | 'country'
        | 'postalCode'
        | 'timezone'
        | 'remarks'
      >
    >,
  ): Promise<BranchRecord | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (changes.code !== undefined) {
      throw new Error('Branch code is generated server-side and cannot be modified.');
    }
    if (changes.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(String(changes.name).trim());
    }
    if (changes.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(changes.status ?? 'active');
    }
    if (changes.isHeadOffice !== undefined) {
      fields.push(`is_head_office = $${idx++}`);
      values.push(changes.isHeadOffice ?? false);
    }
    if (changes.isDefault !== undefined) {
      fields.push(`is_default = $${idx++}`);
      values.push(changes.isDefault ?? false);
    }
    if (changes.addressLine1 !== undefined) {
      fields.push(`address_line1 = $${idx++}`);
      values.push(changes.addressLine1 ?? null);
    }
    if (changes.addressLine2 !== undefined) {
      fields.push(`address_line2 = $${idx++}`);
      values.push(changes.addressLine2 ?? null);
    }
    if (changes.city !== undefined) {
      fields.push(`city = $${idx++}`);
      values.push(changes.city ?? null);
    }
    if (changes.district !== undefined) {
      fields.push(`district = $${idx++}`);
      values.push(changes.district ?? null);
    }
    if (changes.state !== undefined) {
      fields.push(`state = $${idx++}`);
      values.push(changes.state ?? null);
    }
    if (changes.country !== undefined) {
      fields.push(`country = $${idx++}`);
      values.push(changes.country ?? null);
    }
    if (changes.postalCode !== undefined) {
      fields.push(`postal_code = $${idx++}`);
      values.push(changes.postalCode ?? null);
    }
    if (changes.timezone !== undefined) {
      fields.push(`timezone = $${idx++}`);
      values.push(changes.timezone ?? 'UTC');
    }
    if (changes.remarks !== undefined) {
      fields.push(`remarks = $${idx++}`);
      values.push(changes.remarks ?? null);
    }

    if (fields.length === 0) {
      return this.getBranchById(tenantId, organizationId, branchId);
    }

    values.push(tenantId, organizationId, branchId);
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE branches
         SET ${fields.join(', ')}, updated_at = NOW()
         WHERE tenant_id = $${idx} AND organization_id = $${idx + 1} AND id = $${idx + 2} AND is_deleted = false
         RETURNING
         id,
         tenant_id as "tenantId",
         organization_id as "organizationId",
         code,
         name,
         status,
         is_head_office as "isHeadOffice",
         is_default as "isDefault",
         address_line1 as "addressLine1",
         address_line2 as "addressLine2",
         city,
         district,
         state,
         country,
         postal_code as "postalCode",
         timezone,
         remarks,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"`,
        values,
      );
    });

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapBranchRow(result.rows[0]);
  }

  async deactivateBranch(tenantId: string, organizationId: string, branchId: string): Promise<boolean> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE branches
         SET status = 'inactive', is_deleted = true, deleted_at = NOW(), updated_at = NOW()
         WHERE tenant_id = $1 AND organization_id = $2 AND id = $3 AND is_deleted = false
         RETURNING id`,
        [tenantId, organizationId, branchId],
      );
    });

    return (result.rowCount ?? 0) > 0;
  }

  async generateLocationCode(tenantId: string, organizationId: string): Promise<string> {
    const nextNumber = await this.reserveNextCodeValue(tenantId, 'location', organizationId);
    return `LOC${String(nextNumber).padStart(6, '0')}`;
  }

  async createLocation(
    tenantId: string,
    organizationId: string,
    input: {
      code: string;
      name: string;
      description?: string | null;
      status?: 'active' | 'inactive' | 'archived';
      isDefault?: boolean;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      postalCode?: string | null;
      timezone?: string;
    },
  ): Promise<LocationRecord> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `INSERT INTO locations (
         id, tenant_id, organization_id, code, name, description, status, is_default,
         address_line1, address_line2, city, state, country, postal_code, timezone,
         created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW(), 1)
        RETURNING
         id,
         tenant_id as "tenantId",
         organization_id as "organizationId",
         code,
         name,
         description,
         status,
         is_default as "isDefault",
         address_line1 as "addressLine1",
         address_line2 as "addressLine2",
         city,
         state,
         country,
         postal_code as "postalCode",
         timezone,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"`,
        [
          uuidV7(),
          tenantId,
          organizationId,
          input.code.trim(),
          input.name.trim(),
          input.description ?? null,
          input.status ?? 'active',
          input.isDefault ?? false,
          input.addressLine1 ?? null,
          input.addressLine2 ?? null,
          input.city ?? null,
          input.state ?? null,
          input.country ?? null,
          input.postalCode ?? null,
          input.timezone ?? 'UTC',
        ],
      );
    });

    return this.mapLocationRow(result.rows[0]);
  }

  async listLocations(tenantId: string, organizationId: string): Promise<LocationRecord[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT
         id,
         tenant_id as "tenantId",
         organization_id as "organizationId",
         code,
         name,
         description,
         status,
         is_default as "isDefault",
         address_line1 as "addressLine1",
         address_line2 as "addressLine2",
         city,
         state,
         country,
         postal_code as "postalCode",
         timezone,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"
         FROM locations
         WHERE tenant_id = $1 AND organization_id = $2 AND is_deleted = false AND status = 'active'
         ORDER BY name`,
        [tenantId, organizationId],
      );
    });

    return result.rows.map((row) => this.mapLocationRow(row));
  }

  async getLocationById(tenantId: string, organizationId: string, locationId: string): Promise<LocationRecord | null> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT
         id,
         tenant_id as "tenantId",
         organization_id as "organizationId",
         code,
         name,
         description,
         status,
         is_default as "isDefault",
         address_line1 as "addressLine1",
         address_line2 as "addressLine2",
         city,
         state,
         country,
         postal_code as "postalCode",
         timezone,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"
         FROM locations
         WHERE tenant_id = $1 AND organization_id = $2 AND id = $3 AND is_deleted = false AND status = 'active'
         LIMIT 1`,
        [tenantId, organizationId, locationId],
      );
    });

    return result.rows.length > 0 ? this.mapLocationRow(result.rows[0]) : null;
  }

  async updateLocation(
    tenantId: string,
    organizationId: string,
    locationId: string,
    changes: Partial<
      Pick<
        LocationRecord,
        | 'code'
        | 'name'
        | 'description'
        | 'status'
        | 'isDefault'
        | 'addressLine1'
        | 'addressLine2'
        | 'city'
        | 'state'
        | 'country'
        | 'postalCode'
        | 'timezone'
      >
    >,
  ): Promise<LocationRecord | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (changes.code !== undefined) {
      throw new Error('Location code is generated server-side and cannot be modified.');
    }
    if (changes.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(String(changes.name).trim());
    }
    if (changes.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(changes.description ?? null);
    }
    if (changes.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(changes.status ?? 'active');
    }
    if (changes.isDefault !== undefined) {
      fields.push(`is_default = $${idx++}`);
      values.push(changes.isDefault ?? false);
    }
    if (changes.addressLine1 !== undefined) {
      fields.push(`address_line1 = $${idx++}`);
      values.push(changes.addressLine1 ?? null);
    }
    if (changes.addressLine2 !== undefined) {
      fields.push(`address_line2 = $${idx++}`);
      values.push(changes.addressLine2 ?? null);
    }
    if (changes.city !== undefined) {
      fields.push(`city = $${idx++}`);
      values.push(changes.city ?? null);
    }
    if (changes.state !== undefined) {
      fields.push(`state = $${idx++}`);
      values.push(changes.state ?? null);
    }
    if (changes.country !== undefined) {
      fields.push(`country = $${idx++}`);
      values.push(changes.country ?? null);
    }
    if (changes.postalCode !== undefined) {
      fields.push(`postal_code = $${idx++}`);
      values.push(changes.postalCode ?? null);
    }
    if (changes.timezone !== undefined) {
      fields.push(`timezone = $${idx++}`);
      values.push(changes.timezone ?? 'UTC');
    }

    if (fields.length === 0) {
      return this.getLocationById(tenantId, organizationId, locationId);
    }

    values.push(tenantId, organizationId, locationId);
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE locations
         SET ${fields.join(', ')}, updated_at = NOW()
         WHERE tenant_id = $${idx} AND organization_id = $${idx + 1} AND id = $${idx + 2} AND is_deleted = false
         RETURNING
         id,
         tenant_id as "tenantId",
         organization_id as "organizationId",
         code,
         name,
         description,
         status,
         is_default as "isDefault",
         address_line1 as "addressLine1",
         address_line2 as "addressLine2",
         city,
         state,
         country,
         postal_code as "postalCode",
         timezone,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"`,
        values,
      );
    });

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapLocationRow(result.rows[0]);
  }

  async deactivateLocation(tenantId: string, organizationId: string, locationId: string): Promise<boolean> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE locations
         SET status = 'inactive', is_deleted = true, deleted_at = NOW(), updated_at = NOW()
         WHERE tenant_id = $1 AND organization_id = $2 AND id = $3 AND is_deleted = false
         RETURNING id`,
        [tenantId, organizationId, locationId],
      );
    });

    return (result.rowCount ?? 0) > 0;
  }

  async listAccessibleLocationsForUser(
    tenantId: string,
    userId: string,
    organizationId?: string | null,
  ): Promise<LocationRecord[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT l.id,
               l.tenant_id as "tenantId",
               l.organization_id as "organizationId",
               l.code,
               l.name,
               l.description,
               l.status,
               l.is_default as "isDefault",
               l.address_line1 as "addressLine1",
               l.address_line2 as "addressLine2",
               l.city,
               l.state,
               l.country,
               l.postal_code as "postalCode",
               l.timezone,
               l.created_at as "createdAt",
               l.updated_at as "updatedAt",
               l.deleted_at as "deletedAt",
               l.is_deleted as "isDeleted"
         FROM locations l
         WHERE l.tenant_id = $1
          AND l.is_deleted = false
          AND l.status = 'active'
          AND EXISTS (
            SELECT 1
            FROM user_location_access ula
            WHERE ula.tenant_id = l.tenant_id
              AND ula.location_id = l.id
              AND ula.user_id = $2
              AND ula.is_active = true
          )
          AND ($3::uuid IS NULL OR l.organization_id = $3)
         ORDER BY l.name`,
        [tenantId, userId, organizationId ?? null],
      );
    });

    return result.rows.map((row) => this.mapLocationRow(row));
  }

  async getAccessibleLocationByIdForUser(
    tenantId: string,
    userId: string,
    locationId: string,
    organizationId?: string | null,
  ): Promise<LocationRecord | null> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT l.id,
               l.tenant_id as "tenantId",
               l.organization_id as "organizationId",
               l.code,
               l.name,
               l.description,
               l.status,
               l.is_default as "isDefault",
               l.address_line1 as "addressLine1",
               l.address_line2 as "addressLine2",
               l.city,
               l.state,
               l.country,
               l.postal_code as "postalCode",
               l.timezone,
               l.created_at as "createdAt",
               l.updated_at as "updatedAt",
               l.deleted_at as "deletedAt",
               l.is_deleted as "isDeleted"
         FROM locations l
         WHERE l.tenant_id = $1
          AND l.id = $2
          AND l.is_deleted = false
          AND l.status = 'active'
          AND EXISTS (
            SELECT 1
            FROM user_location_access ula
            WHERE ula.tenant_id = l.tenant_id
              AND ula.location_id = l.id
              AND ula.user_id = $3
              AND ula.is_active = true
          )
          AND ($4::uuid IS NULL OR l.organization_id = $4)
         LIMIT 1`,
        [tenantId, locationId, userId, organizationId ?? null],
      );
    });

    return result.rows.length > 0 ? this.mapLocationRow(result.rows[0]) : null;
  }

  async validateLocationAccess(
    tenantId: string,
    userId: string,
    locationId: string,
    organizationId?: string | null,
  ): Promise<boolean> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT 1
         FROM user_location_access ula
         WHERE ula.tenant_id = $1
          AND ula.user_id = $2
          AND ula.location_id = $3
          AND ula.is_active = true
          AND ($4::uuid IS NULL OR ula.organization_id = $4)
         LIMIT 1`,
        [tenantId, userId, locationId, organizationId ?? null],
      );
    });

    return (result.rowCount ?? 0) > 0;
  }

  async listUsers(tenantId: string): Promise<UserAdminRecord[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT
         id,
         tenant_id as "tenantId",
         organization_id as "organizationId",
         default_branch_id as "defaultBranchId",
         default_location_id as "defaultLocationId",
         username,
         email,
         status,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"
         FROM users
         WHERE tenant_id = $1 AND is_deleted = false
         ORDER BY username`,
        [tenantId],
      );
    });

    return result.rows.map((row) => this.mapUserAdminRow(row));
  }

  async getUserById(tenantId: string, userId: string): Promise<UserAdminRecord | null> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT
         id,
         tenant_id as "tenantId",
         organization_id as "organizationId",
         default_branch_id as "defaultBranchId",
         default_location_id as "defaultLocationId",
         username,
         email,
         status,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"
         FROM users
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false
         LIMIT 1`,
        [tenantId, userId],
      );
    });

    return result.rows.length > 0 ? this.mapUserAdminRow(result.rows[0]) : null;
  }

  async listUserOrganizationAccess(tenantId: string, userId: string): Promise<UserOrganizationAccessRecord[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT o.id,
                o.tenant_id as "tenantId",
                o.code,
                o.name,
                o.status,
                o.is_default as "isDefault"
         FROM user_organization_access uoa
         INNER JOIN organizations o
           ON o.id = uoa.organization_id AND o.tenant_id = uoa.tenant_id
         WHERE uoa.tenant_id = $1 AND uoa.user_id = $2
         ORDER BY o.name ASC`,
        [tenantId, userId],
      );
    });

    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      name: row.name,
      status: row.status,
      isDefault: row.isDefault,
    }));
  }

  async listUserBranchAccess(tenantId: string, userId: string): Promise<UserBranchAccessRecord[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `SELECT b.id,
                b.tenant_id as "tenantId",
                b.organization_id as "organizationId",
                o.name as "organizationName",
                b.code,
                b.name,
                b.status
         FROM user_branch_access uba
         INNER JOIN branches b
           ON b.id = uba.branch_id AND b.tenant_id = uba.tenant_id
         INNER JOIN organizations o
           ON o.id = b.organization_id AND o.tenant_id = b.tenant_id
         WHERE uba.tenant_id = $1 AND uba.user_id = $2
         ORDER BY o.name ASC, b.name ASC`,
        [tenantId, userId],
      );
    });

    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      code: row.code,
      name: row.name,
      status: row.status,
    }));
  }

  async updateUser(
    tenantId: string,
    userId: string,
    changes: Partial<
      Pick<
        UserAdminRecord,
        'username' | 'email' | 'organizationId' | 'defaultBranchId' | 'defaultLocationId' | 'status'
      >
    >,
  ): Promise<UserAdminRecord | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (changes.username !== undefined) {
      fields.push(`username = $${idx++}`);
      values.push(String(changes.username).trim());
    }
    if (changes.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(String(changes.email).trim().toLowerCase());
    }
    if (changes.organizationId !== undefined) {
      fields.push(`organization_id = $${idx++}`);
      values.push(changes.organizationId ?? null);
    }
    if (changes.defaultBranchId !== undefined) {
      fields.push(`default_branch_id = $${idx++}`);
      values.push(changes.defaultBranchId ?? null);
    }
    if (changes.defaultLocationId !== undefined) {
      fields.push(`default_location_id = $${idx++}`);
      values.push(changes.defaultLocationId ?? null);
    }
    if (changes.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(changes.status ?? 'active');
    }

    if (fields.length === 0) {
      return this.getUserById(tenantId, userId);
    }

    values.push(tenantId, userId);
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE users
         SET ${fields.join(', ')}, updated_at = NOW()
         WHERE tenant_id = $${idx} AND id = $${idx + 1} AND is_deleted = false
         RETURNING
         id,
         tenant_id as "tenantId",
         organization_id as "organizationId",
         default_branch_id as "defaultBranchId",
         default_location_id as "defaultLocationId",
         username,
         email,
         status,
         created_at as "createdAt",
         updated_at as "updatedAt",
         deleted_at as "deletedAt",
         is_deleted as "isDeleted"`,
        values,
      );
    });

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapUserAdminRow(result.rows[0]);
  }

  async assignUserToOrganization(tenantId: string, userId: string, organizationId: string): Promise<boolean> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const userRow = await client.query(
        `SELECT id, organization_id as "organizationId", default_branch_id as "defaultBranchId" FROM users WHERE tenant_id = $1 AND id = $2 AND is_deleted = false AND status = 'active' LIMIT 1`,
        [tenantId, userId],
      );
      if (userRow.rows.length === 0) {
        return false;
      }

      const organizationRow = await client.query(
        `SELECT id FROM organizations WHERE tenant_id = $1 AND id = $2 AND is_deleted = false AND status = 'active' LIMIT 1`,
        [tenantId, organizationId],
      );
      if (organizationRow.rows.length === 0) {
        return false;
      }

      const currentBranchId = userRow.rows[0].defaultBranchId;
      if (currentBranchId) {
        const branchCheck = await client.query(
          `SELECT id FROM branches WHERE tenant_id = $1 AND organization_id = $2 AND id = $3 AND is_deleted = false AND status = 'active' LIMIT 1`,
          [tenantId, organizationId, currentBranchId],
        );
        if (branchCheck.rows.length === 0) {
          await client.query(
            `UPDATE users SET default_branch_id = NULL, updated_at = NOW() WHERE tenant_id = $1 AND id = $2`,
            [tenantId, userId],
          );
        }
      }

      await client.query(`UPDATE users SET organization_id = $1, updated_at = NOW() WHERE tenant_id = $2 AND id = $3`, [
        organizationId,
        tenantId,
        userId,
      ]);

      await client.query(
        `INSERT INTO user_organization_access (tenant_id, user_id, organization_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, organization_id, tenant_id) DO NOTHING`,
        [tenantId, userId, organizationId],
      );

      return true;
    });

    return result;
  }

  async assignUserToBranch(tenantId: string, userId: string, branchId: string): Promise<boolean> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const userRow = await client.query(
        `SELECT organization_id as "organizationId" FROM users WHERE tenant_id = $1 AND id = $2 AND is_deleted = false LIMIT 1`,
        [tenantId, userId],
      );
      if (userRow.rows.length === 0) {
        return false;
      }

      const branchRow = await client.query(
        `SELECT organization_id as "organizationId" FROM branches WHERE tenant_id = $1 AND id = $2 AND is_deleted = false AND status = 'active' LIMIT 1`,
        [tenantId, branchId],
      );
      if (branchRow.rows.length === 0) {
        return false;
      }

      const userOrganizationId = userRow.rows[0].organizationId;
      if (userOrganizationId && userOrganizationId !== branchRow.rows[0].organizationId) {
        return false;
      }

      const targetOrganizationId = branchRow.rows[0].organizationId;
      await client.query(
        `UPDATE users
         SET organization_id = COALESCE(organization_id, $1), default_branch_id = $2, updated_at = NOW()
         WHERE tenant_id = $3 AND id = $4`,
        [targetOrganizationId, branchId, tenantId, userId],
      );

      await client.query(
        `INSERT INTO user_branch_access (tenant_id, user_id, branch_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, branch_id, tenant_id) DO NOTHING`,
        [tenantId, userId, branchId],
      );

      return true;
    });

    return result;
  }

  async activateUser(tenantId: string, userId: string): Promise<boolean> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE users
         SET status = 'active', updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false
         RETURNING id`,
        [tenantId, userId],
      );
    });

    return (result.rowCount ?? 0) > 0;
  }

  async deactivateUser(tenantId: string, userId: string): Promise<boolean> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return client.query(
        `UPDATE users
         SET status = 'inactive', updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false
         RETURNING id`,
        [tenantId, userId],
      );
    });

    return (result.rowCount ?? 0) > 0;
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

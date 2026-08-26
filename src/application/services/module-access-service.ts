import type { Pool } from 'pg';

import { withTenantContext } from '../../infrastructure/database/tenant-context.js';

export interface EffectiveModule {
  id: string;
  code: string;
  name: string;
  moduleGroup: string;
  description: string | null;
  icon: string | null;
  route: string | null;
  isCore: boolean;
  sortOrder: number;
  enabled: boolean;
  authorized: boolean;
}

export class ModuleAccessService {
  constructor(private readonly pool: Pool, private readonly tenantContextKey = 'app.current_tenant_id') {}

  async hasPermission(tenantId: string, userId: string, permissionKey: string): Promise<boolean> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => client.query(
      `SELECT 1
       FROM permissions p
       INNER JOIN modules m ON m.code = p.module_code
       LEFT JOIN tenant_modules tm ON tm.tenant_id = $1 AND tm.module_id = m.id
       WHERE p.permission_key = $2
         AND (m.is_core = true OR tm.enabled = true)
         AND (
           EXISTS (
             SELECT 1
             FROM role_permissions rp
             INNER JOIN user_roles ur ON ur.role_id = rp.role_id AND ur.tenant_id = $1 AND ur.user_id = $3
             INNER JOIN roles r ON r.id = ur.role_id AND r.tenant_id = $1 AND r.is_deleted = false
             WHERE rp.permission_id = p.id AND rp.tenant_id = $1
           )
           OR EXISTS (
             SELECT 1
             FROM user_permissions up
             INNER JOIN users u ON u.id = up.user_id AND u.tenant_id = $1 AND u.is_deleted = false AND u.status = 'active'
             WHERE up.permission_id = p.id AND up.tenant_id = $1 AND up.user_id = $3 AND up.allow = true
           )
         )
       LIMIT 1`,
      [tenantId, permissionKey, userId],
    ));

    return result.rows.length > 0;
  }

  async listEffectivePermissions(tenantId: string, userId: string): Promise<string[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => client.query(
      `SELECT DISTINCT p.permission_key
       FROM permissions p
       INNER JOIN modules m ON m.code = p.module_code
       LEFT JOIN tenant_modules tm ON tm.tenant_id = $1 AND tm.module_id = m.id
       WHERE (m.is_core = true OR tm.enabled = true)
         AND (
           EXISTS (
             SELECT 1
             FROM role_permissions rp
             INNER JOIN user_roles ur ON ur.role_id = rp.role_id AND ur.tenant_id = $1 AND ur.user_id = $2
             INNER JOIN roles r ON r.id = ur.role_id AND r.tenant_id = $1 AND r.is_deleted = false
             WHERE rp.permission_id = p.id AND rp.tenant_id = $1
           )
           OR EXISTS (
             SELECT 1
             FROM user_permissions up
             INNER JOIN users u ON u.id = up.user_id AND u.tenant_id = $1 AND u.is_deleted = false AND u.status = 'active'
             WHERE up.permission_id = p.id AND up.tenant_id = $1 AND up.user_id = $2 AND up.allow = true
           )
         )
       ORDER BY p.permission_key`,
      [tenantId, userId],
    ));

    return result.rows.map((row) => row.permission_key as string);
  }

  async listEffectiveModules(tenantId: string, userId: string): Promise<EffectiveModule[]> {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => client.query(
      `SELECT
         m.id,
         m.code,
         m.name,
         m.module_group as "moduleGroup",
         m.description,
         m.icon,
         m.route,
         m.is_core as "isCore",
         m.sort_order as "sortOrder",
         (m.is_core = true OR tm.enabled = true) as enabled,
         EXISTS (
           SELECT 1
           FROM permissions p
           WHERE p.module_code = m.code
             AND (
               EXISTS (
                 SELECT 1
                 FROM role_permissions rp
                 INNER JOIN user_roles ur ON ur.role_id = rp.role_id AND ur.tenant_id = $1 AND ur.user_id = $2
                 INNER JOIN roles r ON r.id = ur.role_id AND r.tenant_id = $1 AND r.is_deleted = false
                 WHERE rp.permission_id = p.id AND rp.tenant_id = $1
               )
               OR EXISTS (
                 SELECT 1
                 FROM user_permissions up
                 INNER JOIN users u ON u.id = up.user_id AND u.tenant_id = $1 AND u.is_deleted = false AND u.status = 'active'
                 WHERE up.permission_id = p.id AND up.tenant_id = $1 AND up.user_id = $2 AND up.allow = true
               )
             )
         ) as authorized
       FROM modules m
       LEFT JOIN tenant_modules tm ON tm.tenant_id = $1 AND tm.module_id = m.id
       WHERE (m.is_core = true OR tm.enabled = true)
       ORDER BY m.sort_order, m.name`,
      [tenantId, userId],
    ));

    return result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      moduleGroup: row.moduleGroup,
      description: row.description ?? null,
      icon: row.icon ?? null,
      route: row.route ?? null,
      isCore: Boolean(row.isCore),
      sortOrder: Number(row.sortOrder ?? 0),
      enabled: Boolean(row.enabled),
      authorized: Boolean(row.authorized),
    }));
  }
}

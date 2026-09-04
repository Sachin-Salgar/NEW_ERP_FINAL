import type { Pool } from 'pg';

import { ValidationError, ForbiddenError } from '../../domain/errors.js';
import { withTenantContext } from '../../infrastructure/database/tenant-context.js';

export interface AccessibleModule {
  id: string;
  code: string;
  name: string;
  moduleGroup: string;
  description: string | null;
  icon: string | null;
  route: string | null;
  isCore: boolean;
  sortOrder: number;
}

export class ModuleAccessService {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey = 'app.current_tenant_id',
  ) {}

  private ensureContext(tenantId: string, organizationId: string): void {
    if (!tenantId?.trim()) {
      throw new ValidationError('Tenant context is required.');
    }
    if (!organizationId?.trim()) {
      throw new ValidationError('Organization context is required.');
    }
  }

  async listAccessibleModules(tenantId: string, organizationId: string): Promise<AccessibleModule[]> {
    this.ensureContext(tenantId, organizationId);

    const result = await withTenantContext(
      this.pool,
      this.tenantContextKey,
      tenantId,
      (client) =>
        client.query(
          `SELECT
           m.id,
           m.code,
           m.name,
           m.module_group AS "moduleGroup",
           m.description,
           m.icon,
           m.route,
           m.is_core AS "isCore",
           m.sort_order AS "sortOrder"
         FROM modules m
         INNER JOIN tenant_modules tm
           ON tm.module_id = m.id
          AND tm.tenant_id = $1
          AND tm.enabled = true
         INNER JOIN organization_modules om
           ON om.module_id = m.id
          AND om.tenant_id = $1
          AND om.organization_id = $2
          AND om.enabled = true
         ORDER BY m.sort_order, m.name`,
          [tenantId, organizationId],
        ),
      { organizationId },
    );

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
    }));
  }

  async isModuleEnabled(tenantId: string, organizationId: string, moduleCode: string): Promise<boolean> {
    this.ensureContext(tenantId, organizationId);
    const normalizedCode = moduleCode.trim();
    if (!normalizedCode) {
      throw new ValidationError('Module code is required.');
    }

    const result = await withTenantContext(
      this.pool,
      this.tenantContextKey,
      tenantId,
      (client) =>
        client.query(
          `SELECT 1
         FROM modules m
         INNER JOIN tenant_modules tm
           ON tm.module_id = m.id
          AND tm.tenant_id = $1
          AND tm.enabled = true
         INNER JOIN organization_modules om
           ON om.module_id = m.id
          AND om.tenant_id = $1
          AND om.organization_id = $2
          AND om.enabled = true
         WHERE m.code = $3
         LIMIT 1`,
          [tenantId, organizationId, normalizedCode],
        ),
      { organizationId },
    );

    return (result.rowCount ?? 0) > 0;
  }

  async setOrganizationModule(
    tenantId: string,
    organizationId: string,
    moduleCode: string,
    enabled: boolean,
    actorUserId: string,
  ): Promise<AccessibleModule | null> {
    this.ensureContext(tenantId, organizationId);
    const normalizedCode = moduleCode.trim();
    if (!normalizedCode) {
      throw new ValidationError('Module code is required.');
    }

    return withTenantContext(
      this.pool,
      this.tenantContextKey,
      tenantId,
      async (client) => {
        const moduleResult = await client.query(
          `SELECT m.id, m.code, m.name, m.module_group AS "moduleGroup", m.description, m.icon,
                  m.route, m.is_core AS "isCore", m.sort_order AS "sortOrder"
           FROM modules m
           INNER JOIN tenant_modules tm
             ON tm.module_id = m.id
            AND tm.tenant_id = $1
            AND tm.enabled = true
           WHERE m.code = $2
           LIMIT 1`,
          [tenantId, normalizedCode],
        );
        if (moduleResult.rows.length === 0) {
          throw new ForbiddenError('Module is not enabled for this tenant.');
        }

        const module = moduleResult.rows[0];
        if (!enabled && module.isCore) {
          throw new ValidationError('Core modules cannot be disabled.');
        }

        const result = await client.query(
          `INSERT INTO organization_modules (
             tenant_id, organization_id, module_id, enabled, enabled_at, enabled_by,
             disabled_at, disabled_by
           ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)
           ON CONFLICT (organization_id, module_id)
           DO UPDATE SET
             enabled = EXCLUDED.enabled,
             enabled_at = CASE WHEN EXCLUDED.enabled THEN NOW() ELSE organization_modules.enabled_at END,
             enabled_by = CASE WHEN EXCLUDED.enabled THEN EXCLUDED.enabled_by ELSE organization_modules.enabled_by END,
             disabled_at = CASE WHEN EXCLUDED.enabled THEN NULL ELSE NOW() END,
             disabled_by = CASE WHEN EXCLUDED.enabled THEN NULL ELSE EXCLUDED.disabled_by END
           RETURNING enabled`,
          [
            tenantId,
            organizationId,
            module.id,
            enabled,
            enabled ? actorUserId : null,
            enabled ? null : new Date(),
            enabled ? null : actorUserId,
          ],
        );

        if (result.rows.length === 0 || !result.rows[0].enabled) {
          return null;
        }

        return {
          id: module.id,
          code: module.code,
          name: module.name,
          moduleGroup: module.moduleGroup,
          description: module.description ?? null,
          icon: module.icon ?? null,
          route: module.route ?? null,
          isCore: Boolean(module.isCore),
          sortOrder: Number(module.sortOrder ?? 0),
        };
      },
      { organizationId, userId: actorUserId },
    );
  }
}

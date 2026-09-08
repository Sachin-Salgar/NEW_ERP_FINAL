import type { Pool } from 'pg';

import { ValidationError } from '../../domain/errors.js';
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
  enabled: boolean;
}

export class ModuleAccessService {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey = 'app.current_tenant_id',
  ) {}

  private ensureTenant(tenantId: string): void {
    if (!tenantId?.trim()) throw new ValidationError('Tenant context is required.');
  }

  async listAccessibleModules(tenantId: string): Promise<AccessibleModule[]> {
    this.ensureTenant(tenantId);
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, (client) =>
      client.query(
        `SELECT m.id, m.code, m.name, m.module_group AS "moduleGroup", m.description,
                m.icon, m.route, m.is_core AS "isCore", m.sort_order AS "sortOrder"
           FROM modules m
           JOIN tenant_modules tm ON tm.module_id = m.id
            AND tm.tenant_id = $1 AND tm.enabled = true
          ORDER BY m.sort_order, m.name`,
        [tenantId],
      ),
    );
    return result.rows.map((row) => ({ ...row, enabled: true }));
  }

  async isModuleEnabled(tenantId: string, moduleCode: string, scopedModuleCode?: string): Promise<boolean> {
    this.ensureTenant(tenantId);
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, (client) =>
      client.query(
        `SELECT 1
           FROM modules m
           JOIN tenant_modules tm ON tm.module_id = m.id
            AND tm.tenant_id = $1 AND tm.enabled = true
          WHERE m.code = $2
          LIMIT 1`,
        [tenantId, (scopedModuleCode ?? moduleCode).trim()],
      ),
    );
    return (result.rowCount ?? 0) > 0;
  }

  async setTenantModule(
    tenantId: string,
    moduleCode: string,
    enabled: boolean,
    actorUserId: string,
  ): Promise<AccessibleModule | null> {
    this.ensureTenant(tenantId);
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const moduleResult = await client.query(
        `SELECT m.id, m.code, m.name, m.module_group AS "moduleGroup", m.description,
                m.icon, m.route, m.is_core AS "isCore", m.sort_order AS "sortOrder"
           FROM modules m WHERE m.code = $2 LIMIT 1`,
        [tenantId, moduleCode.trim()],
      );
      const module = moduleResult.rows[0];
      if (!module) return null;
      if (!enabled && module.isCore) throw new ValidationError('Core modules cannot be disabled.');
      const result = await client.query(
        `UPDATE tenant_modules
            SET enabled = $3,
                enabled_at = CASE WHEN $3 THEN NOW() ELSE enabled_at END,
                enabled_by = CASE WHEN $3 THEN $4 ELSE enabled_by END,
                disabled_at = CASE WHEN $3 THEN NULL ELSE NOW() END,
                disabled_by = CASE WHEN $3 THEN NULL ELSE $4 END
          WHERE tenant_id = $1 AND module_id = $2
        RETURNING enabled`,
        [tenantId, module.id, enabled, actorUserId],
      );
      if (!result.rows[0]?.enabled) return null;
      return { ...module, enabled: true };
    });
  }
}

import type { Pool } from 'pg';

export interface TenantTableRlsConfig {
  tableName: string;
  tenantColumn?: string;
  tenantContextKey?: string;
}

export async function applyTenantTableRls(pool: Pool, config: TenantTableRlsConfig): Promise<void> {
  const tableName = config.tableName.trim();
  const tenantColumn = config.tenantColumn ?? 'tenant_id';
  const tenantContextKey = config.tenantContextKey ?? 'app.current_tenant_id';

  if (!tableName) {
    throw new Error('Tenant table name is required when applying RLS.');
  }

  const safeTableName = tableName.replace(/"/g, '""');
  const safeTenantColumn = tenantColumn.replace(/"/g, '""');
  const safeTenantContextValue = tenantContextKey.replace(/'/g, "''");

  await pool.query(`ALTER TABLE "${safeTableName}" ENABLE ROW LEVEL SECURITY;`);
  await pool.query(`ALTER TABLE "${safeTableName}" FORCE ROW LEVEL SECURITY;`);
  await pool.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON "${safeTableName}";`);
  await pool.query(`
    CREATE POLICY tenant_isolation_policy
    ON "${safeTableName}"
    USING ("${safeTenantColumn}" = current_setting('${safeTenantContextValue}', true)::uuid);
  `);
}

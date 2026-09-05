import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = databaseUrl ? it : it.skip;

describe('Inventory Item Master PostgreSQL boundaries', () => {
  let pool: Pool | undefined;
  const tenantA = uuidV7();
  const tenantB = uuidV7();
  const organizationA = uuidV7();
  const organizationB = uuidV7();

  afterAll(async () => {
    if (!pool) return;
    for (const tenantId of [tenantA, tenantB]) {
      await withTenantContext(pool, 'app.current_tenant_id', tenantId, (client) =>
        client.query('DELETE FROM tenants WHERE id = $1', [tenantId]),
      );
    }
    await pool.end();
  });

  runIfDatabase('enforces organization and tenant isolation with FORCE RLS', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const suffix = uuidV7();
    await pool.query(
      `INSERT INTO tenants (id, name, subdomain, slug)
       VALUES ($1, 'Item Tenant A', $2, $2), ($3, 'Item Tenant B', $4, $4)`,
      [tenantA, `item-a-${suffix}`, tenantB, `item-b-${suffix}`],
    );
    await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query(
        `INSERT INTO organizations (id, tenant_id, code, name)
         VALUES ($1, $2, $3, 'Item Organization A'), ($4, $2, $5, 'Item Organization B')`,
        [organizationA, tenantA, `IA${suffix.slice(0, 8)}`, organizationB, `IB${suffix.slice(0, 8)}`],
      ),
    );
    await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query(
        `INSERT INTO inventory_items (tenant_id, organization_id, code, name, unit_of_measure)
         VALUES ($1, $2, 'SKU-A', 'Tenant A Item', 'EA')`,
        [tenantA, organizationA],
      ),
    );
    const hiddenFromOtherTenant = await withTenantContext(pool, 'app.current_tenant_id', tenantB, (client) =>
      client.query('SELECT id FROM inventory_items'),
    );
    expect(hiddenFromOtherTenant.rows).toHaveLength(0);
    const hiddenFromOtherOrganization = await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query('SELECT id FROM inventory_items WHERE organization_id = $1', [organizationB]),
    );
    expect(hiddenFromOtherOrganization.rows).toHaveLength(0);
    const rls = await pool.query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'inventory_items'`,
    );
    expect(rls.rows).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);
  });
});

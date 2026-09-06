import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = databaseUrl ? it : it.skip;

describe('Purchase PostgreSQL isolation', () => {
  let pool: Pool | undefined;

  afterAll(async () => {
    await pool?.end();
  });

  runIfDatabase('enforces FORCE RLS and organization context on Purchase tables', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const tables = [
      'procurement_suppliers',
      'procurement_requisitions',
      'procurement_requisition_lines',
      'procurement_purchase_orders',
      'procurement_purchase_order_lines',
      'procurement_receipts',
      'procurement_receipt_lines',
    ];
    const state = await pool.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE relnamespace='public'::regnamespace AND relname = ANY($1::text[])`,
      [tables],
    );
    expect(new Map(state.rows.map((row) => [row.relname, row])).size).toBe(tables.length);
    for (const row of state.rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }

    const tenant = await pool.query(`SELECT id FROM tenants ORDER BY id LIMIT 1`);
    if (!tenant.rows[0]) return;
    const tenantId = String(tenant.rows[0].id);
    const organization = await withTenantContext(pool, 'app.current_tenant_id', tenantId, (client) =>
      client.query(`SELECT id FROM organizations WHERE tenant_id=$1 ORDER BY id LIMIT 1`, [tenantId]),
    );
    if (!organization.rows[0]) return;
    const organizationId = String(organization.rows[0].id);

    const scoped = await withTenantContext(pool, 'app.current_tenant_id', tenantId, (client) =>
      client.query(`SELECT organization_id FROM organization_modules WHERE tenant_id=$1`, [tenantId]),
    );
    const organizationScoped = await withTenantContext(pool, 'app.current_tenant_id', tenantId, async (client) => {
      await client.query(`SELECT set_config('app.current_tenant_id_organization_id', $1, true)`, [organizationId]);
      return client.query(`SELECT organization_id FROM organization_modules WHERE tenant_id=$1`, [tenantId]);
    });
    expect(organizationScoped.rows.every((row) => String(row.organization_id) === organizationId)).toBe(true);
    expect(organizationScoped.rows.length).toBeLessThanOrEqual(scoped.rows.length);

    const resetContext = await withTenantContext(pool, 'app.current_tenant_id', tenantId, async (client) => {
      await client.query(`SELECT set_config('app.current_tenant_id_organization_id', '', true)`);
      return client.query(`SELECT organization_id FROM organization_modules WHERE tenant_id=$1`, [tenantId]);
    });
    expect(resetContext.rows.length).toBe(scoped.rows.length);

    const tenants = await pool.query(`SELECT id FROM tenants ORDER BY id LIMIT 2`);
    if (tenants.rows.length < 2) return;
    const tenantA = String(tenants.rows[0].id);
    const tenantB = String(tenants.rows[1].id);
    const orgA = await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query(`SELECT id FROM organizations WHERE tenant_id=$1 ORDER BY id LIMIT 1`, [tenantA]),
    );
    const orgB = await withTenantContext(pool, 'app.current_tenant_id', tenantB, (client) =>
      client.query(`SELECT id FROM organizations WHERE tenant_id=$1 ORDER BY id LIMIT 1`, [tenantB]),
    );
    if (!orgA.rows[0] || !orgB.rows[0]) return;
    const supplierA = uuidV7();
    const supplierB = uuidV7();
    await withTenantContext(
      pool,
      'app.current_tenant_id',
      tenantA,
      (client) =>
        client.query(
          `INSERT INTO procurement_suppliers(id,tenant_id,organization_id,code,name)
         VALUES($1,$2,$3,$4,'RLS Tenant A')`,
          [supplierA, tenantA, orgA.rows[0].id, `RLS-A-${supplierA}`],
        ),
      { organizationId: String(orgA.rows[0].id) },
    );
    await withTenantContext(
      pool,
      'app.current_tenant_id',
      tenantB,
      (client) =>
        client.query(
          `INSERT INTO procurement_suppliers(id,tenant_id,organization_id,code,name)
         VALUES($1,$2,$3,$4,'RLS Tenant B')`,
          [supplierB, tenantB, orgB.rows[0].id, `RLS-B-${supplierB}`],
        ),
      { organizationId: String(orgB.rows[0].id) },
    );
    const tenantAView = await withTenantContext(
      pool,
      'app.current_tenant_id',
      tenantA,
      (client) =>
        client.query(`SELECT id FROM procurement_suppliers WHERE id IN ($1,$2) ORDER BY id`, [supplierA, supplierB]),
      { organizationId: String(orgA.rows[0].id) },
    );
    const tenantBView = await withTenantContext(
      pool,
      'app.current_tenant_id',
      tenantB,
      (client) =>
        client.query(`SELECT id FROM procurement_suppliers WHERE id IN ($1,$2) ORDER BY id`, [supplierA, supplierB]),
      { organizationId: String(orgB.rows[0].id) },
    );
    expect(
      tenantAView.rows.map((row) => row.id),
      JSON.stringify(tenantAView.rows),
    ).toEqual([supplierA]);
    expect(
      tenantBView.rows.map((row) => row.id),
      JSON.stringify(tenantBView.rows),
    ).toEqual([supplierB]);
  });
});

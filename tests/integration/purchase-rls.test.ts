import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';
import { createIntegrationApplicationPool } from './database.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = databaseUrl ? it : it.skip;

describe('Purchase PostgreSQL isolation', () => {
  let pool: Pool | undefined;

  afterAll(async () => {
    await pool?.end();
  });

  runIfDatabase('enforces FORCE RLS and organization context on Purchase tables', async () => {
    pool = createIntegrationApplicationPool();
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

    const requisitionA = uuidV7();
    const orderA = uuidV7();
    const receiptA = uuidV7();
    const tenantAContext = await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query(
        `SELECT b.id AS branch_id, fy.id AS financial_year_id
           FROM branches b
           JOIN financial_years fy ON fy.tenant_id=b.tenant_id AND fy.organization_id=b.organization_id
          WHERE b.tenant_id=$1 AND b.organization_id=$2
          LIMIT 1`,
        [tenantA, orgA.rows[0].id],
      ),
    );
    if (!tenantAContext.rows[0]) return;
    await withTenantContext(
      pool,
      'app.current_tenant_id',
      tenantA,
      async (client) => {
        await client.query(
          `INSERT INTO procurement_requisitions(id,tenant_id,organization_id,branch_id,financial_year_id,required_date)
         VALUES($1,$2,$3,$4,$5,'2026-01-01')`,
          [
            requisitionA,
            tenantA,
            orgA.rows[0].id,
            tenantAContext.rows[0].branch_id,
            tenantAContext.rows[0].financial_year_id,
          ],
        );
        await client.query(
          `INSERT INTO procurement_purchase_orders(id,tenant_id,organization_id,branch_id,financial_year_id,supplier_id,order_date)
         VALUES($1,$2,$3,$4,$5,$6,'2026-01-01')`,
          [
            orderA,
            tenantA,
            orgA.rows[0].id,
            tenantAContext.rows[0].branch_id,
            tenantAContext.rows[0].financial_year_id,
            supplierA,
          ],
        );
        await client.query(
          `INSERT INTO procurement_receipts(id,tenant_id,organization_id,branch_id,financial_year_id,purchase_order_id,warehouse_id,receipt_date,operation_key)
         VALUES($1,$2,$3,$4,$5,$6,$7,'2026-01-01',$8)`,
          [
            receiptA,
            tenantA,
            orgA.rows[0].id,
            tenantAContext.rows[0].branch_id,
            tenantAContext.rows[0].financial_year_id,
            orderA,
            uuidV7(),
            `rls-org-${receiptA}`,
          ],
        );
      },
      { organizationId: String(orgA.rows[0].id) },
    );

    const organizationA2 = uuidV7();
    const branchA2 = uuidV7();
    const financialYearA2 = uuidV7();
    const supplierA2 = uuidV7();
    const requisitionA2 = uuidV7();
    const orderA2 = uuidV7();
    const receiptA2 = uuidV7();
    await withTenantContext(
      pool,
      'app.current_tenant_id',
      tenantA,
      async (client) => {
        await client.query(
          `INSERT INTO organizations(id,tenant_id,code,name,status,is_default)
         VALUES($1,$2,$3,'RLS Organization A2','active',false)`,
          [organizationA2, tenantA, `RLS-A2-${organizationA2}`],
        );
        await client.query(
          `INSERT INTO branches(id,tenant_id,organization_id,code,name,is_head_office,is_default)
         VALUES($1,$2,$3,$4,'RLS Branch A2',false,false)`,
          [branchA2, tenantA, organizationA2, `RLS-B2-${branchA2}`],
        );
        await client.query(
          `INSERT INTO financial_years(id,tenant_id,organization_id,name,start_date,end_date,is_active,status,is_locked)
         VALUES($1,$2,$3,'RLS FY A2','2026-01-01','2026-12-31',true,'open',false)`,
          [financialYearA2, tenantA, organizationA2],
        );
        await client.query(
          `INSERT INTO procurement_suppliers(id,tenant_id,organization_id,code,name)
         VALUES($1,$2,$3,$4,'RLS Organization A2')`,
          [supplierA2, tenantA, organizationA2, `RLS-S2-${supplierA2}`],
        );
        await client.query(
          `INSERT INTO procurement_requisitions(id,tenant_id,organization_id,branch_id,financial_year_id,required_date)
         VALUES($1,$2,$3,$4,$5,'2026-01-01')`,
          [requisitionA2, tenantA, organizationA2, branchA2, financialYearA2],
        );
        await client.query(
          `INSERT INTO procurement_purchase_orders(id,tenant_id,organization_id,branch_id,financial_year_id,supplier_id,order_date)
         VALUES($1,$2,$3,$4,$5,$6,'2026-01-01')`,
          [orderA2, tenantA, organizationA2, branchA2, financialYearA2, supplierA2],
        );
        await client.query(
          `INSERT INTO procurement_receipts(id,tenant_id,organization_id,branch_id,financial_year_id,purchase_order_id,warehouse_id,receipt_date,operation_key)
         VALUES($1,$2,$3,$4,$5,$6,$7,'2026-01-01',$8)`,
          [receiptA2, tenantA, organizationA2, branchA2, financialYearA2, orderA2, uuidV7(), `rls-org-${receiptA2}`],
        );
      },
      { organizationId: organizationA2 },
    );

    for (const [table, idA, idA2] of [
      ['procurement_suppliers', supplierA, supplierA2],
      ['procurement_requisitions', requisitionA, requisitionA2],
      ['procurement_purchase_orders', orderA, orderA2],
      ['procurement_receipts', receiptA, receiptA2],
    ] as const) {
      const organizationAOnly = await withTenantContext(
        pool,
        'app.current_tenant_id',
        tenantA,
        (client) => client.query(`SELECT id FROM ${table} WHERE id IN ($1,$2) ORDER BY id`, [idA, idA2]),
        { organizationId: String(orgA.rows[0].id) },
      );
      const organizationA2Only = await withTenantContext(
        pool,
        'app.current_tenant_id',
        tenantA,
        (client) => client.query(`SELECT id FROM ${table} WHERE id IN ($1,$2) ORDER BY id`, [idA, idA2]),
        { organizationId: organizationA2 },
      );
      expect(organizationAOnly.rows.map((row) => row.id)).toEqual([idA]);
      expect(organizationA2Only.rows.map((row) => row.id)).toEqual([idA2]);
    }
  });
});

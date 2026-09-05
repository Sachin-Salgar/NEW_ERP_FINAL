import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';
import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';
import { PostgresInventoryRepository } from '../../src/infrastructure/database/repositories/postgres-inventory-repository.js';
import { InventoryService } from '../../src/application/services/inventory-service.js';
import { UnitOfWork } from '../../src/infrastructure/database/unit-of-work.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = databaseUrl ? it : it.skip;

describe('Inventory foundation PostgreSQL boundaries', () => {
  let pool: Pool | undefined;
  const tenantA = uuidV7();
  const tenantB = uuidV7();
  const organizationA = uuidV7();
  const organizationB = uuidV7();

  afterAll(async () => {
    if (!pool) return;
    for (const tenantId of [tenantA, tenantB]) {
      await withTenantContext(pool, 'app.current_tenant_id', tenantId, (client) =>
        client.query('DELETE FROM tenants WHERE id=$1', [tenantId]),
      );
    }
    await pool.end();
  });

  runIfDatabase('isolates warehouses and stock with FORCE RLS and preserves stock invariants', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const suffix = uuidV7().slice(0, 8);
    const branch = uuidV7();
    const financialYear = uuidV7();
    const item = uuidV7();
    const warehouse = uuidV7();
    await pool.query(
      `INSERT INTO tenants (id,name,subdomain,slug) VALUES ($1,'Inventory A',$2,$2),($3,'Inventory B',$4,$4)`,
      [tenantA, `inventory-a-${suffix}`, tenantB, `inventory-b-${suffix}`],
    );
    await withTenantContext(pool, 'app.current_tenant_id', tenantA, async (client) => {
      await client.query(
        `INSERT INTO organizations (id,tenant_id,code,name) VALUES ($1,$2,$3,'Inventory Org A'),($4,$2,$5,'Inventory Org B')`,
        [organizationA, tenantA, `IA${suffix}`, organizationB, `IB${suffix}`],
      );
      await client.query(
        `INSERT INTO branches (id,tenant_id,organization_id,code,name) VALUES ($1,$2,$3,$4,'Inventory Branch')`,
        [branch, tenantA, organizationA, `BR${suffix}`],
      );
      await client.query(
        `INSERT INTO financial_years (id,tenant_id,organization_id,name,start_date,end_date,status,is_active)
         VALUES ($1,$2,$3,$4,'2026-01-01','2026-12-31','open',true)`,
        [financialYear, tenantA, organizationA, `FY-${suffix}`],
      );
      await client.query(
        `INSERT INTO inventory_items (id,tenant_id,organization_id,code,name,unit_of_measure)
         VALUES ($1,$2,$3,$4,'Inventory Item','EA')`,
        [item, tenantA, organizationA, `SKU-${suffix}`],
      );
      await client.query(
        `INSERT INTO inventory_warehouses (id,tenant_id,organization_id,code,name)
         VALUES ($1,$2,$3,$4,'Main Warehouse')`,
        [warehouse, tenantA, organizationA, `WH-${suffix}`],
      );
      await client.query(
        `INSERT INTO inventory_stock (tenant_id,organization_id,warehouse_id,item_id,on_hand_quantity,reserved_quantity)
         VALUES ($1,$2,$3,$4,10,3)`,
        [tenantA, organizationA, warehouse, item],
      );
    });
    const hidden = await withTenantContext(pool, 'app.current_tenant_id', tenantB, (client) =>
      client.query('SELECT id FROM inventory_stock'),
    );
    expect(hidden.rows).toHaveLength(0);
    const otherOrg = await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query('SELECT id FROM inventory_stock WHERE organization_id=$1', [organizationB]),
    );
    expect(otherOrg.rows).toHaveLength(0);
    const balance = await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query('SELECT on_hand_quantity,reserved_quantity,on_hand_quantity-reserved_quantity AS available FROM inventory_stock'),
    );
    expect(balance.rows[0]).toMatchObject({ on_hand_quantity: '10.0000', reserved_quantity: '3.0000', available: '7.0000' });
    const rls = await pool.query(
      `SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
       WHERE relname IN ('inventory_warehouses','inventory_stock','inventory_reservations','inventory_movements')
       ORDER BY relname`,
    );
    expect(rls.rows).toHaveLength(4);
    expect(rls.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);

    const inventory = new InventoryService(
      new PostgresInventoryRepository(pool),
      { hasPermission: async () => true },
      { isModuleEnabled: async () => true },
      { record: async () => undefined },
      new UnitOfWork(pool),
    );
    const inventoryContext = {
      tenantId: tenantA,
      organizationId: organizationA,
      branchId: branch,
      financialYearId: financialYear,
      userId: uuidV7(),
    };
    const requests = [1, 2].map((index) =>
      inventory.reserve(inventoryContext, {
        warehouseId: warehouse,
        itemId: item,
        quantity: 6,
        sourceType: 'SALES_ORDER',
        sourceId: uuidV7(),
        idempotencyKey: `reservation-${index}-${suffix}`,
      }),
    );
    const outcomes = await Promise.allSettled(requests);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const reserved = await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query('SELECT reserved_quantity FROM inventory_stock WHERE warehouse_id=$1 AND item_id=$2', [warehouse, item]),
    );
    expect(Number(reserved.rows[0].reserved_quantity)).toBe(9);
  });
});

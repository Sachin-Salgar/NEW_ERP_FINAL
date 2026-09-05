import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';
import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';
import { PostgresPricingRepository } from '../../src/infrastructure/database/repositories/postgres-pricing-repository.js';
import { PostgresDiscountRepository } from '../../src/infrastructure/database/repositories/postgres-discount-repository.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = databaseUrl ? it : it.skip;

describe('Sales pricing and discount PostgreSQL boundaries', () => {
  let pool: Pool | undefined;
  const tenantA = uuidV7(); const tenantB = uuidV7(); const orgA = uuidV7(); const orgB = uuidV7(); const branchA = uuidV7(); const actor = uuidV7();
  afterAll(async () => { if (!pool) return; for (const tenant of [tenantA, tenantB]) await withTenantContext(pool, 'app.current_tenant_id', tenant, c => c.query('DELETE FROM tenants WHERE id=$1', [tenant])); await pool.end(); });

  runIfDatabase('enforces tenant/org/branch RLS, item resolution, lifecycle, and concurrency', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const suffix = uuidV7();
    await pool.query(`INSERT INTO tenants(id,name,subdomain,slug) VALUES($1,'Pricing A',$2,$2),($3,'Pricing B',$4,$4)`, [tenantA, `pricing-a-${suffix}`, tenantB, `pricing-b-${suffix}`]);
    await withTenantContext(pool, 'app.current_tenant_id', tenantA, async c => {
      await c.query(`INSERT INTO organizations(id,tenant_id,code,name) VALUES($1,$2,$3,'Org A'),($4,$2,$5,'Org B')`, [orgA, tenantA, `PA${suffix.slice(0,6)}`, orgB, `PB${suffix.slice(0,6)}`]);
      await c.query(`INSERT INTO branches(id,tenant_id,organization_id,code,name,is_default) VALUES($1,$2,$3,$4,'Branch A',true)`, [branchA, tenantA, orgA, `PBR${suffix.slice(0,5)}`]);
    });
    await withTenantContext(pool, 'app.current_tenant_id', tenantB, c => c.query(`INSERT INTO organizations(id,tenant_id,code,name) VALUES($1,$2,$3,'Org B')`, [uuidV7(), tenantB, `PC${suffix.slice(0,6)}`]));
    const pricing = new PostgresPricingRepository(pool); const discounts = new PostgresDiscountRepository(pool);
    const list = await pricing.create({ tenantId: tenantA, organizationId: orgA, branchId: branchA, code: `BRANCH-${suffix.slice(0,6)}`, name: 'Branch prices', currency: 'INR', effectiveFrom: '2026-01-01', actorUserId: actor });
    await pricing.addItem({ tenantId: tenantA, organizationId: orgA, priceListId: list.id, itemCode: 'ITEM-1', unitOfMeasure: 'EA', price: 125, effectiveFrom: '2026-01-01', actorUserId: actor });
    await expect(pricing.getById(tenantB, orgA, list.id)).resolves.toBeNull();
    await expect(pricing.transition({ tenantId: tenantA, organizationId: orgA, id: list.id, status: 'PUBLISHED', expectedVersion: 1, actorUserId: actor })).resolves.toMatchObject({ status: 'PUBLISHED', versionNumber: 2 });
    await expect(pricing.resolvePrice({ tenantId: tenantA, organizationId: orgA, branchId: branchA, itemCode: 'ITEM-1', unitOfMeasure: 'EA', asOf: '2026-02-01' })).resolves.toMatchObject({ price: 125 });
    await expect(pricing.transition({ tenantId: tenantA, organizationId: orgA, id: list.id, status: 'ARCHIVED', expectedVersion: 1, actorUserId: actor })).resolves.toBeNull();
    const discount = await discounts.create({ tenantId: tenantA, organizationId: orgA, code: `DISC-${suffix.slice(0,6)}`, name: 'Ten percent', percentage: 10, effectiveFrom: '2026-01-01', effectiveTo: null, actorUserId: actor });
    await expect(discounts.list(tenantB, orgA)).resolves.toEqual([]);
    await expect(discounts.transition({ tenantId: tenantA, organizationId: orgA, id: discount.id, status: 'PUBLISHED', expectedVersion: 1, actorUserId: actor })).resolves.toMatchObject({ status: 'PUBLISHED', versionNumber: 2 });
    const rls = await pool!.query(`SELECT relrowsecurity,relforcerowsecurity,relname FROM pg_class WHERE relname IN ('sales_price_lists','sales_price_list_items','sales_discount_rules')`);
    expect(rls.rows).toHaveLength(3); expect(rls.rows.every(row => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
    const salesRls = await pool!.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname IN (
          'sales_quotations', 'sales_quotation_items',
          'sales_orders', 'sales_order_items',
          'sales_deliveries', 'sales_delivery_items',
          'sales_invoices', 'sales_invoice_items',
          'sales_returns', 'sales_return_items',
          'sales_credit_notes', 'sales_credit_note_items',
          'sales_price_lists', 'sales_price_list_items',
          'sales_discount_rules'
        )
      ORDER BY relname`);
    expect(salesRls.rows.length).toBe(15);
    expect(salesRls.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
    const role = await pool!.query(`
      SELECT rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user`);
    expect(role.rows).toEqual([{ rolsuper: false, rolbypassrls: false }]);
  });
});

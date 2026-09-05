import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { PostgresQuotationRepository } from '../../src/infrastructure/database/repositories/postgres-quotation-repository.js';
import { UnitOfWork } from '../../src/infrastructure/database/unit-of-work.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = databaseUrl ? it : it.skip;

describe('Sales quotation PostgreSQL tenant and organization isolation', () => {
  let pool: Pool | undefined;
  const tenantA = uuidV7();
  const tenantB = uuidV7();
  const organizationA = uuidV7();
  const organizationB = uuidV7();
  const branchA = uuidV7();
  const financialYearA = uuidV7();
  const customerA = uuidV7();
  const customerB = uuidV7();
  const actor = uuidV7();

  afterAll(async () => {
    if (!pool) return;
    for (const tenantId of [tenantA, tenantB]) {
      await withTenantContext(pool, 'app.current_tenant_id', tenantId, (client) =>
        client.query('DELETE FROM tenants WHERE id = $1', [tenantId]),
      );
    }
    await pool.end();
  });

  runIfDatabase('enforces FORCE RLS, organization scoping, soft delete, and rollback', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const suffix = uuidV7();

    await pool.query(
      `INSERT INTO tenants (id, name, subdomain, slug)
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
      [
        tenantA,
        'Quotation Test A',
        `quotation-a-${suffix}`,
        `quotation-a-${suffix}`,
        tenantB,
        'Quotation Test B',
        `quotation-b-${suffix}`,
        `quotation-b-${suffix}`,
      ],
    );
    await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query(
        `INSERT INTO organizations (id, tenant_id, code, name)
         VALUES ($1, $2, $3, 'Quotation Organization A'), ($4, $2, $5, 'Quotation Organization B')`,
        [organizationA, tenantA, `QA${suffix.slice(0, 8)}`, organizationB, `QB${suffix.slice(0, 8)}`],
      ),
    );
    await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query(
        `INSERT INTO branches (id, tenant_id, organization_id, code, name, is_default)
         VALUES ($1, $2, $3, $4, 'Quotation Branch', true)`,
        [branchA, tenantA, organizationA, `QBR${suffix.slice(0, 6)}`],
      ),
    );
    await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query(
        `INSERT INTO financial_years (id, tenant_id, organization_id, name, start_date, end_date, is_active, status)
         VALUES ($1, $2, $3, 'FY 2026', '2026-01-01', '2026-12-31', true, 'open')`,
        [financialYearA, tenantA, organizationA],
      ),
    );
    await withTenantContext(pool, 'app.current_tenant_id', tenantB, (client) =>
      client.query(
        `INSERT INTO organizations (id, tenant_id, code, name)
         VALUES ($1, $2, $3, 'Quotation Tenant B Organization')`,
        [uuidV7(), tenantB, `QC${suffix.slice(0, 8)}`],
      ),
    );
    await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query(
        `INSERT INTO customers (id, tenant_id, organization_id, name)
         VALUES ($1, $2, $3, 'Quotation Customer A'), ($4, $2, $5, 'Quotation Customer B')`,
        [customerA, tenantA, organizationA, customerB, organizationB],
      ),
    );

    const repository = new PostgresQuotationRepository(pool);
    const input = {
      tenantId: tenantA,
      organizationId: organizationA,
      branchId: branchA,
      financialYearId: financialYearA,
      customerId: customerA,
      quotationDate: '2026-09-01',
      validUntil: '2026-09-30',
      items: [{ description: 'Consulting', quantity: 2, unitPrice: 100, unitOfMeasure: 'hour' }],
      actorUserId: actor,
    };
    const quotation = await repository.create(input);

    await expect(repository.getById(tenantA, organizationA, branchA, financialYearA, quotation.id)).resolves.toMatchObject({
      tenantId: tenantA,
      organizationId: organizationA,
      quotationNumber: 'Q-000001',
      items: [{ description: 'Consulting', quantity: 2, unitPrice: 100, unitOfMeasure: 'hour' }],
    });
    await expect(repository.getById(tenantB, organizationA, branchA, financialYearA, quotation.id)).resolves.toBeNull();
    await expect(repository.getById(tenantA, organizationB, branchA, financialYearA, quotation.id)).resolves.toBeNull();
    await withTenantContext(pool, 'app.current_tenant_id', tenantB, async (client) => {
      await expect(
        client.query('SELECT id FROM sales_quotations WHERE id = $1', [quotation.id]),
      ).resolves.toMatchObject({ rows: [] });
      await expect(
        client.query('UPDATE sales_quotations SET notes = $1 WHERE id = $2', ['cross-tenant', quotation.id]),
      ).resolves.toMatchObject({ rowCount: 0 });
      await expect(client.query('DELETE FROM sales_quotations WHERE id = $1', [quotation.id])).resolves.toMatchObject({
        rowCount: 0,
      });
      await expect(
        client.query(
          `INSERT INTO sales_quotations
             (id, tenant_id, organization_id, quotation_number, customer_id, quotation_date, valid_until)
           VALUES ($1, $2, $3, 'Q-RLS-INSERT', $4, '2026-09-01', '2026-09-30')`,
          [uuidV7(), tenantA, organizationA, customerA],
        ),
      ).rejects.toThrow();
      await expect(
        client.query(
          `INSERT INTO sales_quotation_items
             (tenant_id, organization_id, quotation_id, line_number, description, quantity, unit_price, unit_of_measure)
           VALUES ($1, $2, $3, 1, 'cross-tenant', 1, 1, 'unit')`,
          [tenantA, organizationA, quotation.id],
        ),
      ).rejects.toThrow();
    });
    await expect(
      repository.create({ ...input, tenantId: tenantB, organizationId: organizationB, customerId: customerB }),
    ).rejects.toThrow('Customer must belong to the active organization.');

    await expect(
      repository.update({
        ...input,
        quotationId: quotation.id,
        tenantId: tenantB,
        organizationId: organizationB,
        customerId: customerB,
      }),
    ).rejects.toThrow('Customer must belong to the active organization.');
    await expect(
      repository.update({
        ...input,
        quotationId: quotation.id,
        organizationId: organizationB,
        customerId: customerB,
      }),
    ).resolves.toBeNull();
    await expect(
      repository.list(tenantB, { organizationId: organizationB, page: 1, pageSize: 20, order: 'asc' }),
    ).resolves.toMatchObject({ total: 0, items: [] });

    const concurrent = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        repository.create({
          ...input,
          quotationDate: `2026-09-${String(index + 2).padStart(2, '0')}`,
          validUntil: '2026-09-30',
        }),
      ),
    );
    expect(new Set(concurrent.map((entry) => entry.quotationNumber)).size).toBe(5);

    await expect(
      repository.softDelete({
        tenantId: tenantA,
        organizationId: organizationA,
        branchId: branchA,
        financialYearId: financialYearA,
        quotationId: quotation.id,
        actorUserId: actor,
      }),
    ).resolves.toMatchObject({ isDeleted: true });
    await expect(repository.getById(tenantA, organizationA, branchA, financialYearA, quotation.id)).resolves.toBeNull();
    await expect(
      repository.list(tenantA, {
        organizationId: organizationA,
        branchId: branchA,
        financialYearId: financialYearA,
        page: 1,
        pageSize: 20,
        order: 'asc',
      }),
    ).resolves.toMatchObject({ total: 5 });

    await expect(
      new UnitOfWork(pool).runInTransaction(async () => {
        await repository.create({
          ...input,
          quotationDate: '2026-09-02',
          validUntil: '2026-09-30',
        });
        throw new Error('rollback quotation mutation');
      }),
    ).rejects.toThrow('rollback quotation mutation');
    await expect(
      repository.list(tenantA, {
        organizationId: organizationA,
        page: 1,
        pageSize: 20,
        order: 'asc',
        search: 'Rolled Back',
      }),
    ).resolves.toMatchObject({ total: 0 });

    const rlsState = await pool.query(
      `SELECT relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE relname IN ('sales_quotations', 'sales_quotation_items')
          AND relnamespace = 'public'::regnamespace
        ORDER BY relname`,
    );
    expect(rlsState.rows).toEqual([
      { relrowsecurity: true, relforcerowsecurity: true },
      { relrowsecurity: true, relforcerowsecurity: true },
    ]);
  });
});

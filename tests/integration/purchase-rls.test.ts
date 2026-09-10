import { afterAll, describe, expect, it } from 'vitest';

import { closeFixture, fixture, headers, login } from './authorization-proof-fixtures.js';

describe('Purchase v1 tenant RLS proof', () => {
  let value: Awaited<ReturnType<typeof fixture>>;

  afterAll(async () => {
    if (value) await closeFixture(value);
  });

  it('keeps Purchase data tenant-isolated and protected by FORCE RLS', async () => {
    value = await fixture();
    const tokenA = await login(value.app, value.tenantASeed, value.tenantA.tenantId);
    const tokenB = await login(value.app, value.tenantBSeed, value.tenantB.tenantId);
    const supplier = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/suppliers',
      headers: headers(tokenA, value.tenantA.tenantId),
      payload: { name: 'Tenant A Supplier', code: 'TENANT-A-SUPPLIER' },
    });
    expect(supplier.statusCode).toBe(201);
    const supplierId = supplier.json().supplier.id as string;

    const foreignRead = await value.app.inject({
      method: 'GET',
      url: `/api/v1/purchase/suppliers/${supplierId}`,
      headers: headers(tokenB, value.tenantB.tenantId),
    });
    expect(foreignRead.statusCode).toBe(404);
    const foreignMutation = await value.app.inject({
      method: 'PATCH',
      url: `/api/v1/purchase/suppliers/${supplierId}`,
      headers: headers(tokenB, value.tenantB.tenantId),
      payload: { name: 'Tenant B Tamper', expectedVersion: 1 },
    });
    expect(foreignMutation.statusCode).toBe(404);
    const tenantSpoof = await value.app.inject({
      method: 'GET',
      url: '/api/v1/purchase/suppliers',
      headers: { ...headers(tokenA, value.tenantB.tenantId) },
    });
    expect(tenantSpoof.statusCode).toBe(200);
    expect(tenantSpoof.json().suppliers.some((row: { id: string }) => row.id === supplierId)).toBe(true);

    await value.adminPool.query(
      `DELETE FROM user_branch_access WHERE tenant_id = $1 AND user_id = $2 AND branch_id = $3`,
      [value.tenantA.tenantId, value.tenantA.userId, value.tenantA.branchId],
    );
    const revokedBranch = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/suppliers',
      headers: headers(tokenA, value.tenantA.tenantId),
      payload: { name: 'Revoked Branch Supplier', code: 'REVOKED-BRANCH' },
    });
    expect(revokedBranch.statusCode).toBe(403);
    await value.adminPool.query(
      `INSERT INTO user_branch_access (tenant_id, user_id, branch_id) VALUES ($1, $2, $3)`,
      [value.tenantA.tenantId, value.tenantA.userId, value.tenantA.branchId],
    );
    const foreignFinancialYear = (
      await value.adminPool.query<{ id: string }>(
        `SELECT id FROM financial_years WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
        [value.tenantB.tenantId],
      )
    ).rows[0].id;
    const invalidFinancialYear = await value.app.inject({
      method: 'POST',
      url: '/api/v1/auth/context/branch',
      headers: headers(tokenA, value.tenantA.tenantId),
      payload: { branchId: value.tenantA.branchId, financialYearId: foreignFinancialYear },
    });
    expect(invalidFinancialYear.statusCode).toBe(400);

    const forceRls = await value.adminPool.query<{ relname: string; relforcerowsecurity: boolean }>(
      `SELECT c.relname, c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname IN (
           'procurement_suppliers', 'procurement_requisitions',
           'procurement_requisition_lines', 'procurement_purchase_orders',
           'procurement_purchase_order_lines', 'procurement_receipts',
           'procurement_receipt_lines'
         )`,
    );
    expect(forceRls.rows).toHaveLength(7);
    expect(forceRls.rows.every((row) => row.relforcerowsecurity)).toBe(true);

    const roles = await value.adminPool.query<{ rolname: string; rolbypassrls: boolean }>(
      `SELECT rolname, rolbypassrls
       FROM pg_roles
      WHERE rolname IN ('erp', 'erp_app')`,
    );
    expect(roles.rows.every((row) => !row.rolbypassrls)).toBe(true);
  });
});

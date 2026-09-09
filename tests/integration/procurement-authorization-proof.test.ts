import { afterAll, describe, expect, it } from 'vitest';
import { v7 as uuidV7 } from 'uuid';
import { fixture, closeFixture, headers, login } from './authorization-proof-fixtures.js';

describe('Procurement Authorization Proof', () => {
  let value: Awaited<ReturnType<typeof fixture>>;
  afterAll(async () => { if (value) await closeFixture(value); });
  it('proves procurement authentication, RBAC, tenant isolation, spoof resistance, and RLS', async () => {
    value = await fixture();
    const tokenA = await login(value.app, value.tenantASeed, value.tenantA.tenantId);
    const tokenB = await login(value.app, value.tenantBSeed, value.tenantB.tenantId);
    const missing = await login(value.app, value.missingSeed, value.missing.tenantId);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/purchase/suppliers' })).statusCode).toBe(401);
    const created = await value.app.inject({ method: 'POST', url: '/api/v1/purchase/suppliers', headers: headers(tokenA, value.tenantA.tenantId), payload: { name: 'Proof Supplier', code: 'PROOF-SUP' } });
    expect(created.statusCode).toBe(201);
    const id = created.json().supplier.id;
    const crossTenantRead = await value.app.inject({ method: 'GET', url: `/api/v1/purchase/suppliers/${id}`, headers: headers(tokenB, value.tenantB.tenantId) });
    expect(crossTenantRead.statusCode).toBe(404);
    const tenantSpoofRead = await value.app.inject({
      method: 'GET',
      url: `/api/v1/purchase/suppliers/${id}`,
      headers: headers(tokenA, value.tenantB.tenantId),
    });
    expect(tenantSpoofRead.statusCode).toBe(200);
    expect(tenantSpoofRead.json().supplier.tenant_id ?? tenantSpoofRead.json().supplier.tenantId).toBe(value.tenantA.tenantId);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/purchase/suppliers', headers: headers(missing, value.missing.tenantId) })).statusCode).toBe(403);

    const branchA2 = uuidV7();
    const fyA2 = (await value.adminPool.query<{ id: string }>(
      `SELECT id FROM financial_years WHERE tenant_id = $1 AND is_active = true AND is_deleted = false LIMIT 1`,
      [value.tenantA.tenantId],
    )).rows[0].id;
    const itemA = uuidV7();
    await value.adminPool.query(
      `INSERT INTO branches (id, tenant_id, code, name, status, is_head_office, is_default, city, country, timezone)
       VALUES ($1, $2, $3, $4, 'active', false, false, 'Bengaluru', 'IN', 'UTC')`,
      [branchA2, value.tenantA.tenantId, `PA2-${branchA2.slice(0, 8)}`, 'Procurement Branch A2'],
    );
    await value.adminPool.query(
      `INSERT INTO user_branch_access (tenant_id, user_id, branch_id) VALUES ($1, $2, $3)`,
      [value.tenantA.tenantId, value.tenantA.userId, branchA2],
    );
    await value.adminPool.query(
      `INSERT INTO inventory_items (id, tenant_id, code, name, unit_of_measure, sales_eligible, status)
       VALUES ($1, $2, $3, 'Procurement Proof Item', 'EA', true, 'ACTIVE')`,
      [itemA, value.tenantA.tenantId, `PITEM-${itemA.slice(0, 8)}`],
    );
    const requisitionA1 = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/requisitions',
      headers: headers(tokenA, value.tenantA.tenantId),
      payload: {
        requiredDate: '2026-05-01',
        justification: 'Branch authorization proof',
        lines: [{ itemId: itemA, description: 'Proof item', quantity: 1, unitPrice: 10, unitOfMeasure: 'EA' }],
      },
    });
    if (requisitionA1.statusCode !== 201) console.log('requisition A1 failure', requisitionA1.body, value.tenantA.branchId, fyA2);
    expect(requisitionA1.statusCode).toBe(201);
    const requisitionId = requisitionA1.json().requisition.id as string;
    await value.adminPool.query(`UPDATE financial_years SET branch_id = $1 WHERE id = $2 AND tenant_id = $3`, [
      branchA2,
      fyA2,
      value.tenantA.tenantId,
    ]);
    expect(
      (await value.app.inject({
        method: 'POST',
        url: '/api/v1/auth/context/branch',
        headers: headers(tokenA, value.tenantA.tenantId),
        payload: { branchId: branchA2, financialYearId: fyA2 },
      })).statusCode,
    ).toBe(200);
    const requisitionA2 = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/requisitions',
      headers: headers(tokenA, value.tenantA.tenantId),
      payload: {
        requiredDate: '2026-05-02',
        lines: [{ itemId: itemA, description: 'Proof item A2', quantity: 1, unitPrice: 10, unitOfMeasure: 'EA' }],
      },
    });
    expect(requisitionA2.statusCode).toBe(201);
    const crossBranchRead = await value.app.inject({
        method: 'GET',
        url: `/api/v1/purchase/requisitions/${requisitionId}`,
        headers: headers(tokenA, value.tenantA.tenantId),
      });
    expect(crossBranchRead.statusCode).toBe(404);
    await value.adminPool.query(
      `DELETE FROM user_branch_access WHERE tenant_id = $1 AND user_id = $2 AND branch_id = $3`,
      [value.tenantA.tenantId, value.tenantA.userId, branchA2],
    );
    expect(
      (await value.app.inject({
        method: 'GET',
        url: '/api/v1/purchase/requisitions',
        headers: headers(tokenA, value.tenantA.tenantId),
      })).statusCode,
    ).toBe(403);
    await value.adminPool.query(
      `UPDATE branches SET status = 'inactive' WHERE tenant_id = $1 AND id = $2`,
      [value.tenantA.tenantId, branchA2],
    );
    expect(
      (await value.app.inject({
        method: 'POST',
        url: '/api/v1/auth/context/branch',
        headers: headers(tokenA, value.tenantA.tenantId),
        payload: { branchId: branchA2, financialYearId: fyA2 },
      })).statusCode,
    ).toBe(401);
  });
});

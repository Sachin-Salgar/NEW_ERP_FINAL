import { afterAll, describe, expect, it } from 'vitest';
import { v7 as uuidV7 } from 'uuid';
import { fixture, closeFixture, headers, login } from './authorization-proof-fixtures.js';

describe('Pricing Authorization Proof', () => {
  let value: Awaited<ReturnType<typeof fixture>>;
  afterAll(async () => { if (value) await closeFixture(value); });
  it('proves Sales entitlement, RBAC, tenant isolation, and client tenant spoof resistance', async () => {
    value = await fixture();
    const tokenA = await login(value.app, value.tenantASeed, value.tenantA.tenantId);
    const tokenB = await login(value.app, value.tenantBSeed, value.tenantB.tenantId);
    const missing = await login(value.app, value.missingSeed, value.missing.tenantId);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/sales/price-lists' })).statusCode).toBe(401);
    const created = await value.app.inject({ method: 'POST', url: '/api/v1/sales/price-lists', headers: headers(tokenA, value.tenantA.tenantId), payload: { code: 'PROOF-PRICE', name: 'Proof Prices', currency: 'USD', effectiveFrom: '2026-04-01' } });
    expect(created.statusCode).toBe(201);
    const id = created.json().priceList.id;
    expect((await value.app.inject({ method: 'GET', url: `/api/v1/sales/price-lists/${id}`, headers: headers(tokenB, value.tenantB.tenantId) })).statusCode).toBe(404);
    expect((await value.app.inject({ method: 'GET', url: `/api/v1/sales/price-lists/${id}`, headers: headers(tokenA, value.tenantB.tenantId) })).statusCode).toBe(200);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/sales/price-lists', headers: headers(missing, value.missing.tenantId) })).statusCode).toBe(403);

    const branchA2 = uuidV7();
    const fyA2 = (await value.adminPool.query<{ id: string }>(
      `SELECT id FROM financial_years WHERE tenant_id = $1 AND is_active = true AND is_deleted = false LIMIT 1`,
      [value.tenantA.tenantId],
    )).rows[0].id;
    await value.adminPool.query(
      `INSERT INTO branches (id, tenant_id, code, name, status, is_head_office, is_default, city, country, timezone)
       VALUES ($1, $2, $3, 'Pricing Branch A2', 'active', false, false, 'Bengaluru', 'IN', 'UTC')`,
      [branchA2, value.tenantA.tenantId, `PA2-${branchA2.slice(0, 8)}`],
    );
    await value.adminPool.query(`UPDATE financial_years SET branch_id = $1 WHERE id = $2 AND tenant_id = $3`, [
      branchA2,
      fyA2,
      value.tenantA.tenantId,
    ]);
    await value.adminPool.query(
      `INSERT INTO user_branch_access (tenant_id, user_id, branch_id) VALUES ($1, $2, $3)`,
      [value.tenantA.tenantId, value.tenantA.userId, branchA2],
    );
    expect(
      (await value.app.inject({
        method: 'POST',
        url: '/api/v1/auth/context/branch',
        headers: headers(tokenA, value.tenantA.tenantId),
        payload: { branchId: branchA2, financialYearId: fyA2 },
      })).statusCode,
    ).toBe(200);
    const branchPrice = await value.app.inject({
      method: 'POST',
      url: '/api/v1/sales/price-lists',
      headers: headers(tokenA, value.tenantA.tenantId),
      payload: {
        branchId: branchA2,
        code: 'PROOF-BRANCH-PRICE',
        name: 'Branch Prices',
        currency: 'USD',
        effectiveFrom: '2026-04-01',
      },
    });
    expect(branchPrice.statusCode).toBe(201);
    const spoofedBranchPrice = await value.app.inject({
      method: 'POST',
      url: '/api/v1/sales/price-lists',
      headers: headers(tokenA, value.tenantA.tenantId),
      payload: {
        branchId: value.tenantA.branchId,
        code: 'PROOF-SPOOF-PRICE',
        name: 'Spoofed Branch Prices',
        currency: 'USD',
        effectiveFrom: '2026-04-01',
      },
    });
    expect(spoofedBranchPrice.statusCode).toBe(403);
    await value.adminPool.query(
      `DELETE FROM user_branch_access WHERE tenant_id = $1 AND user_id = $2 AND branch_id = $3`,
      [value.tenantA.tenantId, value.tenantA.userId, branchA2],
    );
    expect(
      (await value.app.inject({
        method: 'POST',
        url: '/api/v1/sales/price-lists',
        headers: headers(tokenA, value.tenantA.tenantId),
        payload: {
          branchId: branchA2,
          code: 'PROOF-REVOKED-PRICE',
          name: 'Revoked Branch Prices',
          currency: 'USD',
          effectiveFrom: '2026-04-01',
        },
      })).statusCode,
    ).toBe(403);
  });
});

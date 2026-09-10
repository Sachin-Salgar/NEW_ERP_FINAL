import { afterAll, describe, expect, it } from 'vitest';
import { fixture, closeFixture, headers, login } from './authorization-proof-fixtures.js';

describe('Discount Authorization Proof', () => {
  let value: Awaited<ReturnType<typeof fixture>>;
  afterAll(async () => { if (value) await closeFixture(value); });
  it('proves Sales entitlement, RBAC, tenant isolation, and client tenant spoof resistance', async () => {
    value = await fixture();
    const tokenA = await login(value.app, value.tenantASeed, value.tenantA.tenantId);
    const tokenB = await login(value.app, value.tenantBSeed, value.tenantB.tenantId);
    const missing = await login(value.app, value.missingSeed, value.missing.tenantId);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/sales/discount-rules' })).statusCode).toBe(401);
    const created = await value.app.inject({ method: 'POST', url: '/api/v1/sales/discount-rules', headers: headers(tokenA, value.tenantA.tenantId), payload: { code: 'PROOF-DISC', name: 'Proof Discount', percentage: 10, effectiveFrom: '2026-04-01' } });
    expect(created.statusCode).toBe(201);
    const id = created.json().discountRule.id;
    expect(
      (
        await value.app.inject({
          method: 'PATCH',
          url: `/api/v1/sales/discount-rules/${id}`,
          headers: headers(missing, value.missing.tenantId),
          payload: { name: 'Unauthorized update', percentage: 20, effectiveFrom: '2026-04-01', effectiveTo: null, expectedVersion: 1 },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await value.app.inject({
          method: 'PATCH',
          url: `/api/v1/sales/discount-rules/${id}`,
          headers: headers(tokenB, value.tenantB.tenantId),
          payload: { name: 'Cross-tenant update', percentage: 20, effectiveFrom: '2026-04-01', effectiveTo: null, expectedVersion: 1 },
        })
      ).statusCode,
    ).toBe(400);
    expect((await value.app.inject({ method: 'GET', url: `/api/v1/sales/discount-rules/${id}`, headers: headers(tokenB, value.tenantB.tenantId) })).statusCode).toBe(400);
    expect((await value.app.inject({ method: 'GET', url: `/api/v1/sales/discount-rules/${id}`, headers: headers(tokenA, value.tenantB.tenantId) })).statusCode).toBe(400);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/sales/discount-rules', headers: headers(missing, value.missing.tenantId) })).statusCode).toBe(403);
  });
});

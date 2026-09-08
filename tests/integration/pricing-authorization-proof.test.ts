import { afterAll, describe, expect, it } from 'vitest';
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
  });
});

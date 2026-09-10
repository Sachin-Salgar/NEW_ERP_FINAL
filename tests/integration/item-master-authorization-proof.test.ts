import { afterAll, describe, expect, it } from 'vitest';
import { fixture, closeFixture, headers, login } from './authorization-proof-fixtures.js';

describe('Item Master Authorization Proof', () => {
  let value: Awaited<ReturnType<typeof fixture>>;
  afterAll(async () => { if (value) await closeFixture(value); });
  it('proves inventory entitlement, RBAC, tenant context, spoof resistance, and RLS', async () => {
    value = await fixture();
    const tokenA = await login(value.app, value.tenantASeed, value.tenantA.tenantId);
    const tokenB = await login(value.app, value.tenantBSeed, value.tenantB.tenantId);
    const missing = await login(value.app, value.missingSeed, value.missing.tenantId);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/inventory/items' })).statusCode).toBe(401);
    const created = await value.app.inject({ method: 'POST', url: '/api/v1/inventory/items', headers: headers(tokenA, value.tenantA.tenantId), payload: { code: 'PROOF-ITEM', name: 'Proof Item', unitOfMeasure: 'EA' } });
    expect(created.statusCode).toBe(201);
    const id = created.json().item.id;
    expect(
      (
        await value.app.inject({
          method: 'PATCH',
          url: `/api/v1/inventory/items/${id}`,
          headers: headers(missing, value.missing.tenantId),
          payload: { name: 'Unauthorized update', unitOfMeasure: 'EA', salesEligible: true, expectedVersion: 1 },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await value.app.inject({
          method: 'PATCH',
          url: `/api/v1/inventory/items/${id}`,
          headers: headers(tokenB, value.tenantB.tenantId),
          payload: { name: 'Cross-tenant update', unitOfMeasure: 'EA', salesEligible: true, expectedVersion: 1 },
        })
      ).statusCode,
    ).toBe(404);
    expect((await value.app.inject({ method: 'GET', url: `/api/v1/inventory/items/${id}`, headers: headers(tokenA, value.tenantA.tenantId) })).statusCode).toBe(200);
    expect((await value.app.inject({ method: 'GET', url: `/api/v1/inventory/items/${id}`, headers: headers(tokenB, value.tenantB.tenantId) })).statusCode).toBe(404);
    expect((await value.app.inject({ method: 'GET', url: `/api/v1/inventory/items/${id}`, headers: headers(tokenA, value.tenantB.tenantId) })).statusCode).toBe(200);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/inventory/items', headers: headers(missing, value.missing.tenantId) })).statusCode).toBe(403);
  });
});

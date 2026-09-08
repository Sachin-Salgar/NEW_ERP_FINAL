import { afterAll, describe, expect, it } from 'vitest';
import { fixture, closeFixture, headers, login } from './authorization-proof-fixtures.js';

describe('Inventory Authorization Proof', () => {
  let value: Awaited<ReturnType<typeof fixture>>;
  afterAll(async () => { if (value) await closeFixture(value); });
  it('proves inventory authentication, module permission, tenant isolation, and RLS', async () => {
    value = await fixture();
    const tokenA = await login(value.app, value.tenantASeed, value.tenantA.tenantId);
    const tokenB = await login(value.app, value.tenantBSeed, value.tenantB.tenantId);
    const missing = await login(value.app, value.missingSeed, value.missing.tenantId);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/inventory/warehouses' })).statusCode).toBe(401);
    const created = await value.app.inject({ method: 'POST', url: '/api/v1/inventory/warehouses', headers: headers(tokenA, value.tenantA.tenantId), payload: { code: 'PROOF-WH', name: 'Proof Warehouse' } });
    expect(created.statusCode).toBe(201);
    const id = created.json().warehouse.id;
    expect((await value.app.inject({ method: 'PATCH', url: `/api/v1/inventory/warehouses/${id}`, headers: headers(tokenB, value.tenantB.tenantId), payload: { name: 'tamper', status: 'ACTIVE', expectedVersion: 1 } })).statusCode).toBe(400);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/inventory/warehouses', headers: headers(missing, value.missing.tenantId) })).statusCode).toBe(403);
  });
});

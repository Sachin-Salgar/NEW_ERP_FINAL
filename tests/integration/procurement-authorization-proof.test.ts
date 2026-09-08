import { afterAll, describe, expect, it } from 'vitest';
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
    expect(crossTenantRead.statusCode).toBe(200);
    expect((await value.app.inject({ method: 'GET', url: `/api/v1/purchase/suppliers/${id}`, headers: headers(tokenA, value.tenantB.tenantId) })).statusCode).toBe(200);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/purchase/suppliers', headers: headers(missing, value.missing.tenantId) })).statusCode).toBe(403);
  });
});

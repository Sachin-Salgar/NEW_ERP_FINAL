import { afterAll, describe, expect, it } from 'vitest';
import { v7 as uuidV7 } from 'uuid';
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

    const itemId = uuidV7();
    const sourceId = uuidV7();
    const warehouseId = created.json().warehouse.id as string;
    await value.adminPool.query(
      `INSERT INTO inventory_items (id, tenant_id, code, name, unit_of_measure, sales_eligible, status)
       VALUES ($1, $2, $3, 'Inventory Proof Item', 'EA', true, 'ACTIVE')`,
      [itemId, value.tenantA.tenantId, `IITEM-${itemId.slice(0, 8)}`],
    );
    const received = await value.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/stock/receipts',
      headers: headers(tokenA, value.tenantA.tenantId),
      payload: {
        warehouseId,
        itemId,
        quantity: 5,
        sourceType: 'PROOF',
        sourceId,
        operationKey: `proof-receipt-${sourceId}`,
      },
    });
    expect(received.statusCode).toBe(201);
    const reservation = await value.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/reservations',
      headers: headers(tokenA, value.tenantA.tenantId),
      payload: {
        warehouseId,
        itemId,
        quantity: 1,
        sourceType: 'PROOF',
        sourceId: uuidV7(),
        idempotencyKey: `proof-reservation-${uuidV7()}`,
      },
    });
    expect(reservation.statusCode).toBe(201);
    const branchA2 = uuidV7();
    const fyA2 = (await value.adminPool.query<{ id: string }>(
      `SELECT id FROM financial_years WHERE tenant_id = $1 AND is_active = true AND is_deleted = false LIMIT 1`,
      [value.tenantA.tenantId],
    )).rows[0].id;
    await value.adminPool.query(
      `INSERT INTO branches (id, tenant_id, code, name, status, is_head_office, is_default, city, country, timezone)
       VALUES ($1, $2, $3, 'Inventory Branch A2', 'active', false, false, 'Bengaluru', 'IN', 'UTC')`,
      [branchA2, value.tenantA.tenantId, `IA2-${branchA2.slice(0, 8)}`],
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
    const branchScopedReservation = await value.app.inject({
      method: 'GET',
      url: '/api/v1/inventory/reservations',
      headers: headers(tokenA, value.tenantA.tenantId),
    });
    expect(branchScopedReservation.statusCode).toBe(200);
    expect(branchScopedReservation.json().reservations).toHaveLength(0);
    await value.adminPool.query(
      `DELETE FROM user_branch_access WHERE tenant_id = $1 AND user_id = $2 AND branch_id = $3`,
      [value.tenantA.tenantId, value.tenantA.userId, branchA2],
    );
    expect(
      (await value.app.inject({
        method: 'GET',
        url: '/api/v1/inventory/reservations',
        headers: headers(tokenA, value.tenantA.tenantId),
      })).statusCode,
    ).toBe(403);
  });
});

import { afterAll, describe, expect, it } from 'vitest';
import { closeFixture, fixture, headers, login } from './authorization-proof-fixtures.js';

describe('Canonical Workflow/BPM enforcement', () => {
  let value: Awaited<ReturnType<typeof fixture>>;

  afterAll(async () => {
    if (value) await closeFixture(value);
  });

  it('does not expose legacy module-local approval endpoints or permissions', async () => {
    value = await fixture();
    const token = await login(value.app, value.tenantASeed, value.tenantA.tenantId);
    const h = headers(token, value.tenantA.tenantId);
    const id = '00000000-0000-7000-8000-000000000001';

    for (const url of [
      `/api/v1/purchase/requisitions/${id}/approve`,
      `/api/v1/purchase/requisitions/${id}/reject`,
      `/api/v1/purchase/purchase-orders/${id}/approve`,
      `/api/v1/purchase/purchase-orders/${id}/reject`,
      `/api/v1/purchase/receipts/${id}/workflow`,
      `/api/v1/sales/returns/${id}/approve`,
      `/api/v1/sales/returns/${id}/reject`,
    ]) {
      expect((await value.app.inject({ method: 'POST', url, headers: h, payload: {} })).statusCode).toBe(404);
    }

    const keys = (await value.adminPool.query(
      `SELECT permission_key FROM permissions
       WHERE permission_key = ANY($1::text[])
       ORDER BY permission_key`,
      [[
        'purchase.requisition.approve',
        'purchase.requisition.reject',
        'purchase.requisition.workflow',
        'purchase.order.approve',
        'purchase.order.reject',
        'purchase.order.workflow',
        'purchase.receipt.workflow',
        'sales.return.approve',
        'sales.return.reject',
      ]],
    )).rows;

    expect(keys).toEqual([]);
  });
});

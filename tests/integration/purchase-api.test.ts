import { afterAll, describe, expect, it } from 'vitest';
import { v7 as uuidV7 } from 'uuid';

import { closeFixture, fixture, headers, login } from './authorization-proof-fixtures.js';

describe('Purchase v1 receipt transaction and API hardening', () => {
  let value: Awaited<ReturnType<typeof fixture>>;

  afterAll(async () => {
    if (value) await closeFixture(value);
  });

  it('completes the approved-order receipt flow, is idempotent, and maps stale versions to 409', async () => {
    value = await fixture();
    const tokenA = await login(value.app, value.tenantASeed, value.tenantA.tenantId);
    const authA = headers(tokenA, value.tenantA.tenantId);
    const itemId = uuidV7();
    await value.adminPool.query(
      `INSERT INTO inventory_items (id, tenant_id, code, name, unit_of_measure, sales_eligible, status)
       VALUES ($1, $2, $3, 'Purchase API Item', 'EA', true, 'ACTIVE')`,
      [itemId, value.tenantA.tenantId, `PURCHASE-${itemId.slice(0, 8)}`],
    );

    const warehouseResponse = await value.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/warehouses',
      headers: authA,
      payload: { code: `PURCHASE-${itemId.slice(0, 8)}`, name: 'Purchase Warehouse' },
    });
    expect(warehouseResponse.statusCode).toBe(201);
    const warehouseId = warehouseResponse.json().warehouse.id as string;

    const supplierResponse = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/suppliers',
      headers: authA,
      payload: { name: 'Purchase Supplier', code: `SUP-${itemId.slice(0, 8)}` },
    });
    expect(supplierResponse.statusCode).toBe(201);
    const supplierId = supplierResponse.json().supplier.id as string;

    const requisitionResponse = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/requisitions',
      headers: authA,
      payload: {
        requiredDate: '2026-06-01',
        justification: 'Purchase receipt proof',
        lines: [{ itemId, description: 'Purchase API Item', quantity: 5, unitPrice: 10, unitOfMeasure: 'EA' }],
      },
    });
    expect(requisitionResponse.statusCode).toBe(201);
    const requisition = requisitionResponse.json().requisition;
    const submittedRequisition = await value.app.inject({
      method: 'POST',
      url: `/api/v1/purchase/requisitions/${requisition.id}/submit`,
      headers: authA,
      payload: { expectedVersion: requisition.version ?? 1 },
    });
    expect(submittedRequisition.statusCode).toBe(200);
    const approvedRequisition = await value.app.inject({
      method: 'POST',
      url: `/api/v1/purchase/requisitions/${requisition.id}/approve`,
      headers: authA,
      payload: { expectedVersion: submittedRequisition.json().requisition.version },
    });
    expect(approvedRequisition.statusCode).toBe(200);

    const orderResponse = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/purchase-orders',
      headers: authA,
      payload: {
        supplierId,
        requisitionId: requisition.id,
        orderDate: '2026-05-01',
        lines: [{ itemId, description: 'Purchase API Item', quantity: 5, unitPrice: 10, unitOfMeasure: 'EA' }],
      },
    });
    expect(orderResponse.statusCode).toBe(201);
    const order = orderResponse.json().purchaseOrder;
    const submittedOrder = await value.app.inject({
      method: 'POST',
      url: `/api/v1/purchase/purchase-orders/${order.id}/submit`,
      headers: authA,
      payload: { expectedVersion: order.version ?? 1 },
    });
    expect(submittedOrder.statusCode).toBe(200);
    const approvedOrder = await value.app.inject({
      method: 'POST',
      url: `/api/v1/purchase/purchase-orders/${order.id}/approve`,
      headers: authA,
      payload: { expectedVersion: submittedOrder.json().purchaseOrder.version },
    });
    expect(approvedOrder.statusCode).toBe(200);

    const operationKey = `purchase-receipt-${itemId}`;
    const receiptResponse = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/receipts',
      headers: authA,
      payload: {
        purchaseOrderId: order.id,
        warehouseId,
        receiptDate: '2026-05-02',
        operationKey,
        lines: [{ itemId, quantity: 5 }],
      },
    });
    expect(receiptResponse.statusCode).toBe(201);
    const receipt = receiptResponse.json().receipt;
    expect(receipt.lines).toEqual([{ itemId, quantity: 5 }]);
    const persistedLines = await value.adminPool.query<{ item_id: string; quantity: string }>(
      `SELECT item_id, quantity FROM procurement_receipt_lines WHERE receipt_id = $1`,
      [receipt.id],
    );
    expect(persistedLines.rows).toEqual([{ item_id: itemId, quantity: '5.0000' }]);

    const completed = await value.app.inject({
      method: 'POST',
      url: `/api/v1/purchase/receipts/${receipt.id}/complete`,
      headers: authA,
      payload: { expectedVersion: 1 },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().receipt.status).toBe('COMPLETED');

    const retried = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/receipts',
      headers: authA,
      payload: {
        purchaseOrderId: order.id,
        warehouseId,
        receiptDate: '2026-05-02',
        operationKey,
        lines: [{ itemId, quantity: 5 }],
      },
    });
    expect(retried.statusCode).toBe(201);
    expect(retried.json().receipt.id).toBe(receipt.id);
    const movementCount = await value.adminPool.query<{ count: string }>(
      `SELECT count(*) FROM inventory_movements WHERE tenant_id = $1 AND source_id = $2`,
      [value.tenantA.tenantId, receipt.id],
    );
    expect(Number(movementCount.rows[0].count)).toBe(1);

    const supplier = await value.app.inject({
      method: 'GET',
      url: `/api/v1/purchase/suppliers/${supplierId}`,
      headers: authA,
    });
    expect(supplier.statusCode).toBe(200);
    const firstUpdate = await value.app.inject({
      method: 'PATCH',
      url: `/api/v1/purchase/suppliers/${supplierId}`,
      headers: authA,
      payload: { name: 'Updated Purchase Supplier', expectedVersion: supplier.json().supplier.version },
    });
    expect(firstUpdate.statusCode).toBe(200);
    const staleUpdate = await value.app.inject({
      method: 'PATCH',
      url: `/api/v1/purchase/suppliers/${supplierId}`,
      headers: authA,
      payload: { name: 'Stale Purchase Supplier', expectedVersion: supplier.json().supplier.version },
    });
    expect(staleUpdate.statusCode).toBe(409);
  });

  it('rolls back receipt completion and inventory posting when inventory validation fails', async () => {
    const tokenA = await login(value.app, value.tenantASeed, value.tenantA.tenantId);
    const authA = headers(tokenA, value.tenantA.tenantId);
    const itemId = uuidV7();
    await value.adminPool.query(
      `INSERT INTO inventory_items (id, tenant_id, code, name, unit_of_measure, sales_eligible, status)
       VALUES ($1, $2, $3, 'Rollback Item', 'EA', true, 'ACTIVE')`,
      [itemId, value.tenantA.tenantId, `ROLLBACK-${itemId.slice(0, 8)}`],
    );
    const supplier = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/suppliers',
      headers: authA,
      payload: { name: 'Rollback Supplier', code: `ROLL-${itemId.slice(0, 8)}` },
    });
    const order = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/purchase-orders',
      headers: authA,
      payload: {
        supplierId: supplier.json().supplier.id,
        orderDate: '2026-05-01',
        lines: [{ itemId, description: 'Rollback Item', quantity: 1, unitPrice: 1, unitOfMeasure: 'EA' }],
      },
    });
    const orderId = order.json().purchaseOrder.id as string;
    const submitted = await value.app.inject({
      method: 'POST',
      url: `/api/v1/purchase/purchase-orders/${orderId}/submit`,
      headers: authA,
      payload: { expectedVersion: 1 },
    });
    await value.app.inject({
      method: 'POST',
      url: `/api/v1/purchase/purchase-orders/${orderId}/approve`,
      headers: authA,
      payload: { expectedVersion: submitted.json().purchaseOrder.version },
    });
    const invalidWarehouseId = uuidV7();
    const receipt = await value.app.inject({
      method: 'POST',
      url: '/api/v1/purchase/receipts',
      headers: authA,
      payload: {
        purchaseOrderId: orderId,
        warehouseId: invalidWarehouseId,
        receiptDate: '2026-05-02',
        operationKey: `rollback-${itemId}`,
        lines: [{ itemId, quantity: 1 }],
      },
    });
    const receiptId = receipt.json().receipt.id as string;
    const auditBefore = await value.adminPool.query<{ count: string }>(
      `SELECT count(*) FROM audit_events
       WHERE tenant_id = $1 AND resource_id = $2 AND action = 'procurement.receipt.completed'`,
      [value.tenantA.tenantId, receiptId],
    );
    const completion = await value.app.inject({
      method: 'POST',
      url: `/api/v1/purchase/receipts/${receiptId}/complete`,
      headers: authA,
      payload: { expectedVersion: 1 },
    });
    expect(completion.statusCode).toBe(400);
    const after = await value.app.inject({
      method: 'GET',
      url: `/api/v1/purchase/receipts/${receiptId}`,
      headers: authA,
    });
    expect(after.statusCode).toBe(200);
    expect(after.json().receipt.status).toBe('DRAFT');
    const movements = await value.adminPool.query<{ count: string }>(
      `SELECT count(*) FROM inventory_movements WHERE tenant_id = $1 AND source_id = $2`,
      [value.tenantA.tenantId, receiptId],
    );
    expect(Number(movements.rows[0].count)).toBe(0);
    const auditAfter = await value.adminPool.query<{ count: string }>(
      `SELECT count(*) FROM audit_events
       WHERE tenant_id = $1 AND resource_id = $2 AND action = 'procurement.receipt.completed'`,
      [value.tenantA.tenantId, receiptId],
    );
    expect(auditAfter.rows[0].count).toBe(auditBefore.rows[0].count);
  });
});

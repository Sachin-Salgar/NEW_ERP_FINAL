import { afterAll, describe, expect, it } from 'vitest';
import { v7 as uuidV7 } from 'uuid';

import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';
import { createTestApp, createTestPool } from '../helpers/test-app.js';

const runIfDatabase = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL ? it : it.skip;

describe('Purchase to Inventory integration', () => {
  let pool: ReturnType<typeof createTestPool> | undefined;
  let app: Awaited<ReturnType<typeof createTestApp>> | undefined;

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  runIfDatabase('posts receipt inventory atomically, idempotently, and prevents concurrent over-receipt', async () => {
    pool = createTestPool();
    const repository = new PostgresPlatformRepository(pool);
    await new PlatformBootstrapService(repository).seedReferenceData();
    const suffix = `${Date.now()}-${uuidV7()}`;
    const input = {
      tenant: { name: `Purchase Inventory Tenant ${suffix}`, subdomain: `pi-${suffix}`, slug: `pi-${suffix}` },
      organization: { code: `PI${suffix}`.slice(0, 18), name: 'Purchase Inventory Organization' },
      branch: { code: `PIB${suffix}`.slice(0, 15), name: 'Head Office' },
      administrator: {
        username: `purchase-inventory-admin-${suffix}`,
        email: `purchase-inventory-admin-${suffix}@example.com`,
        password: 'Password123!',
      },
      role: { code: `purchase-inventory-admin-${suffix}`.slice(0, 20), name: 'Purchase Inventory Administrator' },
      permissions: [],
      subscriptionPlanName: 'Starter',
    };
    const bootstrap = await new TenantBootstrapService(repository, new BcryptPasswordHasher()).bootstrapTenant(input);
    const itemId = uuidV7();
    const warehouseId = uuidV7();
    await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, async (client) => {
      const financialYearId = uuidV7();
      await client.query(
        `INSERT INTO financial_years
          (id,tenant_id,organization_id,name,start_date,end_date,is_active,status,is_locked)
         VALUES ($1,$2,$3,'FY 2026','2026-01-01','2026-12-31',true,'open',false)`,
        [financialYearId, bootstrap.tenantId, bootstrap.organizationId],
      );
      const branch = await client.query(
        `SELECT id FROM branches WHERE tenant_id=$1 AND organization_id=$2 ORDER BY id LIMIT 1`,
        [bootstrap.tenantId, bootstrap.organizationId],
      );
      await client.query(
        `INSERT INTO inventory_items(id,tenant_id,organization_id,code,name,unit_of_measure,created_by)
         VALUES($1,$2,$3,$4,'Integration Item','EA',$5)`,
        [itemId, bootstrap.tenantId, bootstrap.organizationId, `PI-${itemId}`, bootstrap.userId],
      );
      await client.query(
        `INSERT INTO inventory_warehouses(id,tenant_id,organization_id,code,name,created_by)
         VALUES($1,$2,$3,$4,'Integration Warehouse',$5)`,
        [warehouseId, bootstrap.tenantId, bootstrap.organizationId, `PI-${warehouseId}`, bootstrap.userId],
      );
      await client.query(
        `INSERT INTO tenant_modules(id,tenant_id,module_id,enabled,enabled_at)
         SELECT gen_random_uuid(),$1,id,true,NOW() FROM modules WHERE code IN ('purchase','inventory')
         ON CONFLICT (tenant_id,module_id) DO UPDATE SET enabled=true,disabled_at=NULL`,
        [bootstrap.tenantId],
      );
      await client.query(
        `INSERT INTO organization_modules(id,tenant_id,organization_id,module_id,enabled,enabled_at)
         SELECT gen_random_uuid(),$1,$2,id,true,NOW() FROM modules WHERE code IN ('purchase','inventory')
         ON CONFLICT (organization_id,module_id) DO UPDATE SET enabled=true,disabled_at=NULL`,
        [bootstrap.tenantId, bootstrap.organizationId],
      );
      await client.query(
        `INSERT INTO user_permissions(tenant_id,user_id,permission_id,allow)
         SELECT $1,$2,id,true FROM permissions WHERE module_code IN ('purchase','inventory')
         ON CONFLICT (tenant_id,user_id,permission_id) DO UPDATE SET allow=true`,
        [bootstrap.tenantId, bootstrap.userId],
      );
      expect(branch.rows[0]?.id).toBe(bootstrap.branchId);
      await client.query(`UPDATE users SET default_branch_id=$1 WHERE id=$2 AND tenant_id=$3`, [
        bootstrap.branchId,
        bootstrap.userId,
        bootstrap.tenantId,
      ]);
      await client.query(
        `UPDATE user_sessions SET branch_id=$1, financial_year_id=$2
         WHERE user_id=$3 AND tenant_id=$4`,
        [bootstrap.branchId, financialYearId, bootstrap.userId, bootstrap.tenantId],
      );
    });

    app = await createTestApp(pool);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-id': bootstrap.tenantId },
      payload: { identifier: input.administrator.username, password: input.administrator.password },
    });
    expect(login.statusCode).toBe(200);
    const headers = {
      authorization: ['Bearer', login.json().accessToken].join(' '),
      'x-tenant-id': bootstrap.tenantId,
    };
    const create = async (quantity: number, operationKey: string, lineItemId = itemId, createReceipt = true) => {
      const supplier = await app!.inject({
        method: 'POST',
        url: '/api/v1/purchase/suppliers',
        headers,
        payload: { name: `Supplier ${operationKey}`, code: `S-${uuidV7()}` },
      });
      expect(supplier.statusCode, supplier.body).toBe(201);
      const supplierId = supplier.json().supplier.id;
      const order = await app!.inject({
        method: 'POST',
        url: '/api/v1/purchase/purchase-orders',
        headers,
        payload: {
          supplierId,
          orderDate: '2026-01-10',
          lines: [
            { itemId: lineItemId, description: 'Integration item', quantity, unitPrice: 10, unitOfMeasure: 'EA' },
          ],
        },
      });
      expect(order.statusCode).toBe(201);
      const orderId = order.json().purchaseOrder.id;
      let detail = await app!.inject({ method: 'GET', url: `/api/v1/purchase/purchase-orders/${orderId}`, headers });
      let version = detail.json().purchaseOrder.version;
      expect(
        (
          await app!.inject({
            method: 'POST',
            url: `/api/v1/purchase/purchase-orders/${orderId}/submit`,
            headers,
            payload: { expectedVersion: version },
          })
        ).statusCode,
      ).toBe(200);
      detail = await app!.inject({ method: 'GET', url: `/api/v1/purchase/purchase-orders/${orderId}`, headers });
      version = detail.json().purchaseOrder.version;
      expect(
        (
          await app!.inject({
            method: 'POST',
            url: `/api/v1/purchase/purchase-orders/${orderId}/approve`,
            headers,
            payload: { expectedVersion: version },
          })
        ).statusCode,
      ).toBe(200);
      if (!createReceipt) return { orderId, receiptId: undefined };
      const receipt = await app!.inject({
        method: 'POST',
        url: '/api/v1/purchase/receipts',
        headers,
        payload: {
          purchaseOrderId: orderId,
          warehouseId,
          receiptDate: '2026-01-11',
          operationKey,
          lines: [{ itemId: lineItemId, quantity }],
        },
      });
      expect(receipt.statusCode).toBe(201);
      return { orderId, receiptId: receipt.json().receipt.id };
    };

    const first = await create(4, `receipt-${uuidV7()}`);
    const receipt = await app.inject({ method: 'GET', url: `/api/v1/purchase/receipts/${first.receiptId}`, headers });
    const firstCompletion = await app.inject({
      method: 'POST',
      url: `/api/v1/purchase/receipts/${first.receiptId}/complete`,
      headers,
      payload: { expectedVersion: receipt.json().receipt.version },
    });
    expect(firstCompletion.statusCode).toBe(200);
    const duplicateCompletion = await app.inject({
      method: 'POST',
      url: `/api/v1/purchase/receipts/${first.receiptId}/complete`,
      headers,
      payload: { expectedVersion: 1 },
    });
    expect(duplicateCompletion.statusCode).toBe(200);

    const stock = await app.inject({ method: 'GET', url: '/api/v1/inventory/stock', headers });
    expect(stock.statusCode).toBe(200);
    expect(stock.json().stock.find((row: { itemId: string }) => row.itemId === itemId).onHandQuantity).toBe(4);
    expect(first.receiptId).toMatch(/^[0-9a-f-]{36}$/);
    const movements = await withTenantContext(
      pool,
      'app.current_tenant_id',
      bootstrap.tenantId,
      (client) =>
        client.query(
          `SELECT count(*)::int AS count FROM inventory_movements WHERE tenant_id=$1 AND organization_id=$2 AND source_id=$3`,
          [bootstrap.tenantId, bootstrap.organizationId, first.receiptId],
        ),
      { organizationId: bootstrap.organizationId },
    );
    expect(movements.rows[0].count).toBe(1);

    const concurrentA = await create(10, `concurrent-a-${uuidV7()}`);
    const concurrentBReceipt = await app.inject({
      method: 'POST',
      url: '/api/v1/purchase/receipts',
      headers,
      payload: {
        purchaseOrderId: concurrentA.orderId,
        warehouseId,
        receiptDate: '2026-01-11',
        operationKey: `concurrent-b-${uuidV7()}`,
        lines: [{ itemId, quantity: 6 }],
      },
    });
    expect(concurrentBReceipt.statusCode).toBe(201);
    const concurrentB = { receiptId: concurrentBReceipt.json().receipt.id };
    const complete = async (receiptId: string) => {
      const current = await app!.inject({ method: 'GET', url: `/api/v1/purchase/receipts/${receiptId}`, headers });
      return app!.inject({
        method: 'POST',
        url: `/api/v1/purchase/receipts/${receiptId}/complete`,
        headers,
        payload: { expectedVersion: current.json().receipt.version },
      });
    };
    const results = await Promise.all([complete(concurrentA.receiptId), complete(concurrentB.receiptId)]);
    expect(results.filter((result) => result.statusCode === 200)).toHaveLength(1);
    expect(results.filter((result) => result.statusCode >= 400)).toHaveLength(1);

    const failed = await create(1, `rollback-${uuidV7()}`, uuidV7());
    const failedReceipt = await app.inject({
      method: 'GET',
      url: `/api/v1/purchase/receipts/${failed.receiptId}`,
      headers,
    });
    const failedCompletion = await app.inject({
      method: 'POST',
      url: `/api/v1/purchase/receipts/${failed.receiptId}/complete`,
      headers,
      payload: { expectedVersion: failedReceipt.json().receipt.version },
    });
    expect(failedCompletion.statusCode).toBe(400);
    const rolledBackReceipt = await app.inject({
      method: 'GET',
      url: `/api/v1/purchase/receipts/${failed.receiptId}`,
      headers,
    });
    expect(rolledBackReceipt.json().receipt.status).toBe('DRAFT');
    const rollbackMovements = await withTenantContext(
      pool,
      'app.current_tenant_id',
      bootstrap.tenantId,
      (client) =>
        client.query(`SELECT count(*)::int AS count FROM inventory_movements WHERE source_id=$1`, [failed.receiptId]),
      { organizationId: bootstrap.organizationId },
    );
    expect(rollbackMovements.rows[0].count).toBe(0);

    const splitOrder = await create(10, `split-order-${uuidV7()}`, itemId, false);
    const completeSplitReceipt = async (quantity: number) => {
      const draft = await app!.inject({
        method: 'POST',
        url: '/api/v1/purchase/receipts',
        headers,
        payload: {
          purchaseOrderId: splitOrder.orderId,
          warehouseId,
          receiptDate: '2026-01-12',
          operationKey: `split-${quantity}-${uuidV7()}`,
          lines: [{ itemId, quantity }],
        },
      });
      expect(draft.statusCode).toBe(201);
      const current = await app!.inject({
        method: 'GET',
        url: `/api/v1/purchase/receipts/${draft.json().receipt.id}`,
        headers,
      });
      const completed = await app!.inject({
        method: 'POST',
        url: `/api/v1/purchase/receipts/${draft.json().receipt.id}/complete`,
        headers,
        payload: { expectedVersion: current.json().receipt.version },
      });
      expect(completed.statusCode).toBe(200);
    };
    await completeSplitReceipt(4);
    await completeSplitReceipt(3);
    await completeSplitReceipt(3);
    const splitMovements = await withTenantContext(
      pool,
      'app.current_tenant_id',
      bootstrap.tenantId,
      (client) =>
        client.query(
          `SELECT count(*)::int AS count, COALESCE(sum(im.quantity),0)::numeric AS total
             FROM inventory_movements im
             JOIN procurement_receipts pr ON pr.id=im.source_id
            WHERE im.tenant_id=$1 AND im.organization_id=$2 AND im.source_type='PURCHASE_RECEIPT'
              AND im.item_id=$3 AND pr.purchase_order_id=$4`,
          [bootstrap.tenantId, bootstrap.organizationId, itemId, splitOrder.orderId],
        ),
      { organizationId: bootstrap.organizationId },
    );
    expect(splitMovements.rows[0].count).toBe(3);
    expect(Number(splitMovements.rows[0].total)).toBe(10);
  });
});

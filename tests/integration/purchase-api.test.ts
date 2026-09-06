import { afterAll, describe, expect, it } from 'vitest';
import { v7 as uuidV7 } from 'uuid';

import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';
import { createTestApp, createTestPool } from '../helpers/test-app.js';

const runIfDatabase = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL ? it : it.skip;

describe('Purchase HTTP API', () => {
  let pool: ReturnType<typeof createTestPool> | undefined;
  let app: Awaited<ReturnType<typeof createTestApp>> | undefined;

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  runIfDatabase('enforces supplier CRUD, soft delete, optimistic versioning, and auth', async () => {
    pool = createTestPool();
    const repository = new PostgresPlatformRepository(pool);
    await new PlatformBootstrapService(repository).seedReferenceData();
    const suffix = `${Date.now()}-${uuidV7()}`;
    const input = {
      tenant: { name: `Purchase API Tenant ${suffix}`, subdomain: `purchase-${suffix}`, slug: `purchase-${suffix}` },
      organization: { code: `P${suffix}`.slice(0, 18), name: 'Purchase Organization' },
      branch: { code: `PB${suffix}`.slice(0, 15), name: 'Head Office' },
      administrator: {
        username: `purchase-admin-${suffix}`,
        email: `purchase-admin-${suffix}@example.com`,
        password: 'Password123!',
      },
      role: { code: `purchase-admin-${suffix}`.slice(0, 20), name: 'Purchase Administrator' },
      permissions: [],
      subscriptionPlanName: 'Starter',
    };
    const bootstrap = await new TenantBootstrapService(repository, new BcryptPasswordHasher()).bootstrapTenant(input);
    const itemId = uuidV7();
    const warehouseId = uuidV7();
    await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, async (client) => {
      await client.query(
        `INSERT INTO financial_years (id,tenant_id,organization_id,name,start_date,end_date,is_active,status,is_locked)
         VALUES ($1,$2,$3,'FY 2026','2026-01-01','2026-12-31',true,'open',false)`,
        [uuidV7(), bootstrap.tenantId, bootstrap.organizationId],
      );
      const module = await client.query(`SELECT id FROM modules WHERE code='purchase'`);
      const moduleId = module.rows[0]?.id;
      if (!moduleId) throw new Error('Purchase module seed is missing.');
      await client.query(
        `INSERT INTO tenant_modules(id,tenant_id,module_id,enabled,enabled_at) VALUES($1,$2,$3,true,NOW())
         ON CONFLICT (tenant_id,module_id) DO UPDATE SET enabled=true,disabled_at=NULL`,
        [uuidV7(), bootstrap.tenantId, moduleId],
      );
      await client.query(
        `INSERT INTO organization_modules(id,tenant_id,organization_id,module_id,enabled,enabled_at) VALUES($1,$2,$3,$4,true,NOW())
         ON CONFLICT (organization_id,module_id) DO UPDATE SET enabled=true,disabled_at=NULL`,
        [uuidV7(), bootstrap.tenantId, bootstrap.organizationId, moduleId],
      );
      const inventoryModule = await client.query(`SELECT id FROM modules WHERE code='inventory'`);
      await client.query(
        `INSERT INTO tenant_modules(id,tenant_id,module_id,enabled,enabled_at) VALUES($1,$2,$3,true,NOW())
         ON CONFLICT (tenant_id,module_id) DO UPDATE SET enabled=true,disabled_at=NULL`,
        [uuidV7(), bootstrap.tenantId, inventoryModule.rows[0].id],
      );
      await client.query(
        `INSERT INTO organization_modules(id,tenant_id,organization_id,module_id,enabled,enabled_at) VALUES($1,$2,$3,$4,true,NOW())
         ON CONFLICT (organization_id,module_id) DO UPDATE SET enabled=true,disabled_at=NULL`,
        [uuidV7(), bootstrap.tenantId, bootstrap.organizationId, inventoryModule.rows[0].id],
      );
      await client.query(
        `INSERT INTO user_permissions(tenant_id,user_id,permission_id,allow)
         SELECT $1,$2,id,true FROM permissions WHERE module_code IN ('purchase','inventory')
         ON CONFLICT (tenant_id,user_id,permission_id) DO UPDATE SET allow=true`,
        [bootstrap.tenantId, bootstrap.userId],
      );
      await client.query(
        `INSERT INTO inventory_items(id,tenant_id,organization_id,code,name,unit_of_measure,created_by)
         VALUES($1,$2,$3,$4,'Purchase API Item','EA',$5)`,
        [itemId, bootstrap.tenantId, bootstrap.organizationId, `PA-${itemId}`, bootstrap.userId],
      );
      await client.query(
        `INSERT INTO inventory_warehouses(id,tenant_id,organization_id,code,name,created_by)
         VALUES($1,$2,$3,$4,'Purchase API Warehouse',$5)`,
        [warehouseId, bootstrap.tenantId, bootstrap.organizationId, `PA-${warehouseId}`, bootstrap.userId],
      );
    });

    app = await createTestApp(pool);
    expect((await app.inject({ method: 'GET', url: '/api/v1/purchase/suppliers' })).statusCode).toBe(401);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-id': bootstrap.tenantId },
      payload: { identifier: input.administrator.username, password: input.administrator.password },
    });
    expect(login.statusCode).toBe(200);
    const headers = { authorization: `Bearer ${login.json().accessToken}`, 'x-tenant-id': bootstrap.tenantId };

    const authenticatedUser = login.json().user;
    expect(authenticatedUser.tenantId).toBe(bootstrap.tenantId);
    expect(authenticatedUser.organizationId).toBe(bootstrap.organizationId);
    const permissionMatrix = [
      ['purchase.supplier.read', 'GET', '/api/v1/purchase/suppliers', undefined],
      ['purchase.supplier.create', 'POST', '/api/v1/purchase/suppliers', { name: 'Permission probe' }],
      [
        'purchase.supplier.update',
        'PATCH',
        `/api/v1/purchase/suppliers/${uuidV7()}`,
        { name: 'Probe', expectedVersion: 1 },
      ],
      ['purchase.supplier.delete', 'DELETE', `/api/v1/purchase/suppliers/${uuidV7()}`, { expectedVersion: 1 }],
      ['purchase.requisition.read', 'GET', '/api/v1/purchase/requisitions', undefined],
      [
        'purchase.requisition.create',
        'POST',
        '/api/v1/purchase/requisitions',
        {
          requiredDate: '2026-01-01',
          lines: [{ itemId: uuidV7(), description: 'Probe', quantity: 1, unitOfMeasure: 'EA' }],
        },
      ],
      [
        'purchase.requisition.update',
        'PATCH',
        `/api/v1/purchase/requisitions/${uuidV7()}`,
        { requiredDate: '2026-01-01', expectedVersion: 1 },
      ],
      ...['submit', 'approve', 'reject', 'cancel'].map((action) => [
        `purchase.requisition.${action}`,
        'POST',
        `/api/v1/purchase/requisitions/${uuidV7()}/${action}`,
        { expectedVersion: 1 },
      ]),
      ['purchase.order.read', 'GET', '/api/v1/purchase/purchase-orders', undefined],
      [
        'purchase.order.create',
        'POST',
        '/api/v1/purchase/purchase-orders',
        {
          supplierId: uuidV7(),
          orderDate: '2026-01-01',
          lines: [{ itemId: uuidV7(), description: 'Probe', quantity: 1, unitOfMeasure: 'EA' }],
        },
      ],
      [
        'purchase.order.update',
        'PATCH',
        `/api/v1/purchase/purchase-orders/${uuidV7()}`,
        { orderDate: '2026-01-01', expectedVersion: 1 },
      ],
      ...['submit', 'approve', 'reject', 'cancel'].map((action) => [
        `purchase.order.${action}`,
        'POST',
        `/api/v1/purchase/purchase-orders/${uuidV7()}/${action}`,
        { expectedVersion: 1 },
      ]),
      ['purchase.receipt.read', 'GET', '/api/v1/purchase/receipts', undefined],
      [
        'purchase.receipt.create',
        'POST',
        '/api/v1/purchase/receipts',
        {
          purchaseOrderId: uuidV7(),
          warehouseId: uuidV7(),
          receiptDate: '2026-01-01',
          operationKey: `permission-probe-${uuidV7()}`,
          lines: [{ itemId: uuidV7(), quantity: 1 }],
        },
      ],
      [
        'purchase.receipt.update',
        'PATCH',
        `/api/v1/purchase/receipts/${uuidV7()}`,
        {
          warehouseId: uuidV7(),
          receiptDate: '2026-01-01',
          lines: [{ itemId: uuidV7(), quantity: 1 }],
          expectedVersion: 1,
        },
      ],
      ...['complete', 'cancel'].map((action) => [
        `purchase.receipt.${action}`,
        'POST',
        `/api/v1/purchase/receipts/${uuidV7()}/${action}`,
        { expectedVersion: 1 },
      ]),
    ] as const;
    for (const [permission, method, url, payload] of permissionMatrix as unknown as Array<
      [string, 'GET' | 'POST' | 'PATCH' | 'DELETE', string, Record<string, unknown> | undefined]
    >) {
      await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, (client) =>
        client.query(
          `DELETE FROM user_permissions
            WHERE tenant_id=$1 AND user_id=$2
              AND permission_id=(SELECT id FROM permissions WHERE permission_key=$3)`,
          [bootstrap.tenantId, bootstrap.userId, permission],
        ),
      );
      const denied = await app.inject({ method, url, headers, payload });
      expect(denied.statusCode, permission).toBe(403);
      expect(denied.json().error.code, permission).toBe('FORBIDDEN');
      await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, (client) =>
        client.query(
          `INSERT INTO user_permissions(tenant_id,user_id,permission_id,allow)
           SELECT $1,$2,id,true FROM permissions WHERE permission_key=$3
           ON CONFLICT (tenant_id,user_id,permission_id) DO UPDATE SET allow=true`,
          [bootstrap.tenantId, bootstrap.userId, permission],
        ),
      );
      const authorized = await app.inject({ method, url, headers, payload });
      expect(authorized.statusCode, permission).not.toBe(401);
      expect(authorized.statusCode, permission).not.toBe(403);
      if (authorized.statusCode >= 400) expect(authorized.json().error.code, permission).not.toBe('FORBIDDEN');
    }

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/purchase/suppliers',
      headers,
      payload: { name: '   ', code: 'SUP-INVALID' },
    });
    expect(invalid.statusCode).toBe(400);
    const unexpectedField = await app.inject({
      method: 'POST',
      url: '/api/v1/purchase/suppliers',
      headers,
      payload: { name: 'Strict Supplier', unexpected: true },
    });
    expect(unexpectedField.statusCode).toBe(400);
    const invalidPage = await app.inject({
      method: 'GET',
      url: '/api/v1/purchase/suppliers?page_size=101',
      headers,
    });
    expect(invalidPage.statusCode).toBe(400);

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/purchase/suppliers',
      headers,
      payload: { name: '  Acme Supplier  ', code: `SUP-${uuidV7().slice(0, 8)}` },
    });
    expect(created.statusCode, created.body).toBe(201);
    const supplier = created.json().supplier;
    expect(supplier.name).toBe('Acme Supplier');

    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/purchase/suppliers/${supplier.id}`,
      headers,
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().supplier.id).toBe(supplier.id);
    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/purchase/suppliers/${supplier.id}`,
      headers,
      payload: {
        name: 'Updated Supplier',
        email: 'updated@example.com',
        expectedVersion: supplier.version ?? 1,
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().supplier.name).toBe('Updated Supplier');

    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/v1/purchase/suppliers/${supplier.id}`,
      headers,
      payload: { name: 'Stale', expectedVersion: 999 },
    });
    expect(stale.statusCode).toBe(404);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/purchase/suppliers/${supplier.id}`,
      headers,
      payload: { expectedVersion: updated.json().supplier.version ?? 2 },
    });
    expect(deleted.statusCode).toBe(200);
    const listed = await app.inject({ method: 'GET', url: '/api/v1/purchase/suppliers', headers });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().suppliers.some((item: { id: string }) => item.id === supplier.id)).toBe(false);

    const activeSupplierResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/purchase/suppliers',
      headers,
      payload: { name: 'Lifecycle Supplier', code: `LIFE-${uuidV7()}` },
    });
    const activeSupplierId = activeSupplierResponse.json().supplier.id;
    const requisitionResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/purchase/requisitions',
      headers,
      payload: {
        requiredDate: '2026-02-01',
        justification: 'Lifecycle test',
        lines: [{ itemId, description: 'Purchase API Item', quantity: 10, unitPrice: 5, unitOfMeasure: 'EA' }],
      },
    });
    expect(requisitionResponse.statusCode).toBe(201);
    const requisitionId = requisitionResponse.json().requisition.id;
    let requisition = await app.inject({
      method: 'GET',
      url: `/api/v1/purchase/requisitions/${requisitionId}`,
      headers,
    });
    let requisitionVersion = requisition.json().requisition.version;
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/purchase/requisitions/${requisitionId}`,
          headers,
          payload: { requiredDate: '2026-02-02', justification: 'Updated', expectedVersion: requisitionVersion },
        })
      ).statusCode,
    ).toBe(200);
    requisition = await app.inject({ method: 'GET', url: `/api/v1/purchase/requisitions/${requisitionId}`, headers });
    requisitionVersion = requisition.json().requisition.version;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/purchase/requisitions/${requisitionId}/submit`,
          headers,
          payload: { expectedVersion: requisitionVersion },
        })
      ).statusCode,
    ).toBe(200);
    requisition = await app.inject({ method: 'GET', url: `/api/v1/purchase/requisitions/${requisitionId}`, headers });
    requisitionVersion = requisition.json().requisition.version;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/purchase/requisitions/${requisitionId}/approve`,
          headers,
          payload: { expectedVersion: requisitionVersion },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/purchase/requisitions/${requisitionId}`,
          headers,
          payload: {
            requiredDate: '2026-03-01',
            justification: 'Rejected update',
            expectedVersion: requisitionVersion,
          },
        })
      ).statusCode,
    ).toBe(404);

    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/purchase/purchase-orders',
      headers,
      payload: {
        supplierId: activeSupplierId,
        orderDate: '2026-02-05',
        lines: [{ itemId, description: 'Purchase API Item', quantity: 10, unitPrice: 5, unitOfMeasure: 'EA' }],
      },
    });
    expect(orderResponse.statusCode).toBe(201);
    const orderId = orderResponse.json().purchaseOrder.id;
    let order = await app.inject({ method: 'GET', url: `/api/v1/purchase/purchase-orders/${orderId}`, headers });
    let orderVersion = order.json().purchaseOrder.version;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/purchase/purchase-orders/${orderId}/submit`,
          headers,
          payload: { expectedVersion: orderVersion },
        })
      ).statusCode,
    ).toBe(200);
    order = await app.inject({ method: 'GET', url: `/api/v1/purchase/purchase-orders/${orderId}`, headers });
    orderVersion = order.json().purchaseOrder.version;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/purchase/purchase-orders/${orderId}/approve`,
          headers,
          payload: { expectedVersion: orderVersion },
        })
      ).statusCode,
    ).toBe(200);

    const receiptResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/purchase/receipts',
      headers,
      payload: {
        purchaseOrderId: orderId,
        warehouseId,
        receiptDate: '2026-02-06',
        operationKey: `api-receipt-${uuidV7()}`,
        lines: [{ itemId, quantity: 6 }],
      },
    });
    expect(receiptResponse.statusCode).toBe(201);
    const receiptId = receiptResponse.json().receipt.id;
    const secondDraft = await app.inject({
      method: 'POST',
      url: '/api/v1/purchase/receipts',
      headers,
      payload: {
        purchaseOrderId: orderId,
        warehouseId,
        receiptDate: '2026-02-06',
        operationKey: `api-draft-${uuidV7()}`,
        lines: [{ itemId, quantity: 6 }],
      },
    });
    expect(secondDraft.statusCode).toBe(201);
    const duplicateLines = await app.inject({
      method: 'POST',
      url: '/api/v1/purchase/receipts',
      headers,
      payload: {
        purchaseOrderId: orderId,
        warehouseId,
        receiptDate: '2026-02-06',
        operationKey: `api-duplicate-${uuidV7()}`,
        lines: [
          { itemId, quantity: 1 },
          { itemId, quantity: 1 },
        ],
      },
    });
    expect(duplicateLines.statusCode).toBe(400);
    let receipt = await app.inject({ method: 'GET', url: `/api/v1/purchase/receipts/${receiptId}`, headers });
    let receiptVersion = receipt.json().receipt.version;
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/purchase/receipts/${receiptId}`,
          headers,
          payload: {
            warehouseId,
            receiptDate: '2026-02-07',
            lines: [{ itemId, quantity: 5 }],
            expectedVersion: receiptVersion,
          },
        })
      ).statusCode,
    ).toBe(200);
    receipt = await app.inject({ method: 'GET', url: `/api/v1/purchase/receipts/${receiptId}`, headers });
    receiptVersion = receipt.json().receipt.version;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/purchase/receipts/${receiptId}/complete`,
          headers,
          payload: { expectedVersion: receiptVersion },
        })
      ).statusCode,
    ).toBe(200);

    await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, async (client) => {
      await client.query(
        `DELETE FROM user_permissions
          WHERE tenant_id=$1 AND user_id=$2
            AND permission_id IN (
              SELECT id FROM permissions
               WHERE permission_key IN (
                 'purchase.requisition.submit','purchase.requisition.approve',
                 'purchase.requisition.reject','purchase.requisition.cancel',
                 'purchase.order.submit','purchase.order.approve',
                 'purchase.order.reject','purchase.order.cancel',
                 'purchase.receipt.complete','purchase.receipt.cancel'
               )
            )`,
        [bootstrap.tenantId, bootstrap.userId],
      );
    });
    for (const route of [
      `/api/v1/purchase/requisitions/${requisitionId}/submit`,
      `/api/v1/purchase/requisitions/${requisitionId}/approve`,
      `/api/v1/purchase/requisitions/${requisitionId}/reject`,
      `/api/v1/purchase/requisitions/${requisitionId}/cancel`,
      `/api/v1/purchase/purchase-orders/${orderId}/submit`,
      `/api/v1/purchase/purchase-orders/${orderId}/approve`,
      `/api/v1/purchase/purchase-orders/${orderId}/reject`,
      `/api/v1/purchase/purchase-orders/${orderId}/cancel`,
      `/api/v1/purchase/receipts/${receiptId}/complete`,
      `/api/v1/purchase/receipts/${receiptId}/cancel`,
    ]) {
      expect(
        (await app.inject({ method: 'POST', url: route, headers, payload: { expectedVersion: 1 } })).statusCode,
        route,
      ).toBe(403);
    }
    for (const request of [
      {
        url: `/api/v1/purchase/requisitions/${requisitionId}/workflow`,
        payload: { status: 'CANCELLED', expectedVersion: 1 },
      },
      {
        url: `/api/v1/purchase/purchase-orders/${orderId}/workflow`,
        payload: { status: 'CANCELLED', expectedVersion: 1 },
      },
      {
        url: `/api/v1/purchase/receipts/${receiptId}/workflow`,
        payload: { status: 'CANCELLED', expectedVersion: 1 },
      },
    ]) {
      expect(
        (await app.inject({ method: 'POST', url: request.url, headers, payload: request.payload })).statusCode,
        request.url,
      ).toBe(403);
    }
  });
});

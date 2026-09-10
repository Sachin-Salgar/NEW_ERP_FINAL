import { afterAll, describe, expect, it } from 'vitest';
import { v7 as uuidV7 } from 'uuid';

import { parseAppConfig, resolveDatabaseUrl } from '../../src/config/schema.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { createApplication } from '../../src/presentation/http/app.js';
import { createIntegrationAdminPool, createIntegrationApplicationPool } from './database.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = it;

const salesPermissions = [
  'sales.quotation.read',
  'sales.quotation.create',
  'sales.quotation.update',
  'sales.quotation.delete',
  'sales.quotation.send',
  'sales.quotation.accept',
  'sales.quotation.reject',
  'sales.quotation.expire',
  'sales.quotation.cancel',
  'sales.order.read',
  'sales.order.create',
  'sales.order.update',
  'sales.order.delete',
  'sales.order.confirm',
  'sales.order.cancel',
  'sales.order.close',
  'sales.order.reserve',
  'sales.pricing.read',
  'sales.discount.read',
  'customer.read',
  'customer.create',
  'customer.update',
  'customer.delete',
  'inventory.item.read',
  'inventory.item.create',
  'inventory.item.update',
  'inventory.item.delete',
  'inventory.warehouse.read',
  'inventory.warehouse.create',
  'inventory.warehouse.update',
  'inventory.warehouse.delete',
  'branch.read',
];

function buildSeed(name: string, suffix: string, permissions: string[]) {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`.slice(0, 60);
  return {
    tenant: {
      name: `${name} ${suffix}`,
      displayName: `${name} ${suffix}`,
      subdomain: slug,
      slug,
      timezone: 'UTC',
      currency: 'USD',
      locale: 'en_US',
    },
    Tenant: { code: `${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}${suffix}`.slice(0, 18), name: `${name} ${suffix}`, fiscalCalendar: 'standard' },
    branch: { code: `${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}${suffix}`.slice(0, 15), name: `${name} Branch ${suffix}`, city: 'Bengaluru', country: 'IN' },
    administrator: {
      username: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`.slice(0, 50),
      email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}@example.com`,
      password: 'Password123!',
    },
    role: { code: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`.slice(0, 20), name: `${name} Admin ${suffix}` },
    permissions,
    subscriptionPlanName: 'Starter',
    initialFinancialYear: { name: `FY-${suffix}`, startDate: '2026-04-01', endDate: '2027-03-31' },
  };
}

async function login(app: Awaited<ReturnType<typeof createApplication>>, seed: ReturnType<typeof buildSeed>, tenantId: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: seed.tenant.subdomain, 'x-tenant-id': tenantId },
    payload: { identifier: seed.administrator.username, password: seed.administrator.password },
  });
  expect(response.statusCode).toBe(200);
  return response.json().accessToken as string;
}

describe('Sales order API integration', () => {
  let pool: ReturnType<typeof createIntegrationApplicationPool> | undefined;
  let adminPool: ReturnType<typeof createIntegrationAdminPool> | undefined;
  let app: Awaited<ReturnType<typeof createApplication>> | undefined;

  afterAll(async () => {
    await app?.close();
    await pool?.end();
    await adminPool?.end();
  });

  runIfDatabase('creates an order from an accepted quotation and maps stale versions to 409', async () => {
    pool = createIntegrationApplicationPool();
    adminPool = createIntegrationAdminPool();
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);
    await platformBootstrapService.seedReferenceData();

    const suffix = `${Date.now()}-${uuidV7()}`;
    const seed = buildSeed('Sales Order', suffix, salesPermissions);
    const tenant = await tenantBootstrapService.bootstrapTenant(seed);
    const config = parseAppConfig({
      ...process.env,
      NODE_ENV: 'test',
      APP_NAME: 'new-erp-final',
      HOST: '127.0.0.1',
      PORT: '3002',
      API_PREFIX: '/api/v1',
      LOG_LEVEL: 'info',
      DATABASE_URL: databaseUrl!,
      DATABASE_POOL_MIN: '1',
      DATABASE_POOL_MAX: '10',
      JWT_SECRET: '12345678901234567890123456789012',
      JWT_ISSUER: 'new-erp-final',
      TENANT_HEADER: 'x-tenant-id',
      TENANT_CONTEXT_KEY: 'app.current_tenant_id',
    });
    app = await createApplication(config, pool);

    const token = await login(app, seed, tenant.tenantId);
    const headers = { authorization: `Bearer ${token}`, 'x-tenant-id': tenant.tenantId };

    const customerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/customers',
      headers,
      payload: { name: 'Sales Order Customer' },
    });
    expect(customerResponse.statusCode).toBe(201);
    const customerId = customerResponse.json().customer.id as string;

    const itemResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/items',
      headers,
      payload: { code: `SO-ITEM-${Date.now()}`, name: 'Sales Order Widget', unitOfMeasure: 'EA', salesEligible: true },
    });
    expect(itemResponse.statusCode).toBe(201);
    const itemId = itemResponse.json().item.id as string;

    const warehouseResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/warehouses',
      headers,
      payload: { code: `SO-WH-${Date.now()}`, name: 'Sales Order Warehouse' },
    });
    expect(warehouseResponse.statusCode).toBe(201);
    const warehouseId = warehouseResponse.json().warehouse.id as string;

    const quotationResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/sales/quotations',
      headers,
      payload: {
        customerId,
        quotationDate: '2026-04-01',
        validUntil: '2026-04-15',
        items: [{ itemId, description: 'Sales Order Widget', quantity: 2, unitPrice: 25, unitOfMeasure: 'EA' }],
      },
    });
    expect(quotationResponse.statusCode).toBe(201);
    const quotation = quotationResponse.json().quotation;
    expect(quotation.customerId).toBe(customerId);

    const sentResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/sales/quotations/${quotation.id}/send`,
      headers,
      payload: { expectedVersion: quotation.versionNumber },
    });
    expect(sentResponse.statusCode).toBe(200);
    const sentQuotation = sentResponse.json().quotation;
    expect(sentQuotation.status).toBe('SENT');

    const acceptedResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/sales/quotations/${quotation.id}/accept`,
      headers,
      payload: { expectedVersion: sentQuotation.versionNumber },
    });
    expect(acceptedResponse.statusCode).toBe(200);
    const acceptedQuotation = acceptedResponse.json().quotation;
    expect(acceptedQuotation.status).toBe('ACCEPTED');

    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/sales/orders',
      headers,
      payload: { quotationId: quotation.id, warehouseId },
    });
    expect(orderResponse.statusCode).toBe(201);
    const order = orderResponse.json().order;
    expect(order.quotationId).toBe(quotation.id);
    expect(order.customerId).toBe(customerId);
    expect(order.warehouseId).toBe(warehouseId);
    expect(order.orderNumber).toMatch(/^SO-/);
    expect(order.status).toBe('DRAFT');

    const firstUpdate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sales/orders/${order.id}`,
      headers,
      payload: { notes: 'First patch', expectedVersion: order.versionNumber },
    });
    expect(firstUpdate.statusCode).toBe(200);

    const staleUpdate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sales/orders/${order.id}`,
      headers,
      payload: { notes: 'Second patch', expectedVersion: order.versionNumber },
    });
    expect(staleUpdate.statusCode).toBe(409);
  });
});

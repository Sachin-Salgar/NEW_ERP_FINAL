import { expect } from 'vitest';
import type { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';
import { parseAppConfig, resolveDatabaseUrl } from '../../src/config/schema.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { createApplication } from '../../src/presentation/http/app.js';
import { createIntegrationAdminPool, createIntegrationApplicationPool } from './database.js';

export const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
export const suffix = `${Date.now()}-${uuidV7()}`;
export const allRemainingPermissions = [
  'branch.read',
  'inventory.item.read', 'inventory.item.create', 'inventory.item.update', 'inventory.item.delete',
  'inventory.warehouse.read', 'inventory.warehouse.create', 'inventory.warehouse.update',
  'inventory.stock.read', 'inventory.stock.receive', 'inventory.reservation.read', 'inventory.reservation.create',
  'inventory.reservation.release', 'inventory.reservation.fulfill', 'inventory.stock.return',
  'purchase.supplier.read', 'purchase.supplier.create', 'purchase.supplier.update', 'purchase.supplier.delete',
  'sales.pricing.read', 'sales.pricing.create', 'sales.pricing.update', 'sales.pricing.publish', 'sales.pricing.archive',
  'sales.discount.read', 'sales.discount.create', 'sales.discount.update', 'sales.discount.publish', 'sales.discount.archive',
  'tax.configuration.read', 'tax.configuration.create', 'tax.configuration.update',
  'tax.configuration.activate', 'tax.configuration.deactivate',
];

export function seed(name: string, permissions: string[]) {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`.slice(0, 60);
  return {
    tenant: { name: `${name} ${suffix}`, displayName: `${name} ${suffix}`, subdomain: slug, slug, timezone: 'UTC', currency: 'USD', locale: 'en_US' },
    Tenant: { code: `${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}${suffix}`.slice(0, 18), name: `${name} ${suffix}`, fiscalCalendar: 'standard' },
    branch: { code: `${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}${suffix}`.slice(0, 15), name: `${name} Branch ${suffix}`, city: 'Bengaluru', country: 'IN' },
    administrator: { username: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`.slice(0, 50), email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}@example.com`, password: 'Password123!' },
    role: { code: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`.slice(0, 20), name: `${name} Admin ${suffix}` },
    permissions, subscriptionPlanName: 'Starter',
    initialFinancialYear: { name: `FY-${suffix}`, startDate: '2026-04-01', endDate: '2027-03-31' },
  };
}

export async function fixture() {
  const pool = createIntegrationApplicationPool();
  const adminPool = createIntegrationAdminPool();
  const repository = new PostgresPlatformRepository(pool);
  const hasher = new BcryptPasswordHasher();
  await new PlatformBootstrapService(repository).seedReferenceData();
  const bootstrap = new TenantBootstrapService(repository, hasher);
  const tenantASeed = seed('Proof Tenant A', allRemainingPermissions);
  const tenantBSeed = seed('Proof Tenant B', allRemainingPermissions);
  const missingSeed = seed('Proof Missing', ['branch.read']);
  const tenantA = await bootstrap.bootstrapTenant(tenantASeed);
  const tenantB = await bootstrap.bootstrapTenant(tenantBSeed);
  const missing = await bootstrap.bootstrapTenant(missingSeed);
  const config = parseAppConfig({
    ...process.env, NODE_ENV: 'test', APP_NAME: 'new-erp-final', HOST: '127.0.0.1', PORT: '3001',
    API_PREFIX: '/api/v1', LOG_LEVEL: 'info', DATABASE_URL: databaseUrl!, DATABASE_POOL_MIN: '1', DATABASE_POOL_MAX: '10',
    JWT_SECRET: '12345678901234567890123456789012', JWT_ISSUER: 'new-erp-final', TENANT_HEADER: 'x-tenant-id', TENANT_CONTEXT_KEY: 'app.current_tenant_id',
  });
  const app = await createApplication(config, pool);
  return { app, pool, adminPool, tenantA, tenantB, missing, tenantASeed, tenantBSeed, missingSeed };
}

export async function login(app: Awaited<ReturnType<typeof createApplication>>, value: ReturnType<typeof seed>, tenantId: string) {
  const response = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    headers: { host: value.tenant.subdomain, 'x-tenant-id': tenantId },
    payload: { identifier: value.administrator.username, password: value.administrator.password },
  });
  expect(response.statusCode).toBe(200);
  return response.json().accessToken as string;
}

export function headers(token: string, tenantId: string) {
  return { authorization: `Bearer ${token}`, 'x-tenant-id': tenantId };
}

export async function closeFixture(value: Awaited<ReturnType<typeof fixture>>) {
  await value.app.close();
  await value.pool.end();
  await value.adminPool.end();
}

import { afterAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { parseAppConfig, resolveDatabaseUrl } from '../../src/config/schema.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { createApplication } from '../../src/presentation/http/app.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';
import { createIntegrationAdminPool, createIntegrationApplicationPool } from './database.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = it;
function buildTenantSeed(baseName: string, suffix: string, permissions: string[]) {
  const slug = `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`.slice(0, 60);
  return {
    tenant: {
      name: `${baseName} ${suffix}`,
      displayName: `${baseName} ${suffix}`,
      subdomain: `${slug}`,
      slug,
      timezone: 'UTC',
      currency: 'USD',
      locale: 'en_US',
    },
    Tenant: {
      code: `${baseName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}${suffix}`.slice(0, 18),
      name: `${baseName} ${suffix}`,
      fiscalCalendar: 'standard',
    },
    branch: {
      code: `${baseName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}${suffix}`.slice(0, 15),
      name: `${baseName} Branch ${suffix}`,
      city: 'Bengaluru',
      country: 'IN',
    },
    administrator: {
      username: `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`.slice(0, 50),
      email: `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}@example.com`,
      password: 'Password123!',
    },
    role: {
      code: `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`.slice(0, 20),
      name: `${baseName} Admin ${suffix}`,
    },
    permissions,
    subscriptionPlanName: 'Starter',
    initialFinancialYear: {
      name: `FY-${suffix}`,
      startDate: '2026-04-01',
      endDate: '2027-03-31',
    },
  };
}

async function loginTenant(app: Awaited<ReturnType<typeof createApplication>>, seed: ReturnType<typeof buildTenantSeed>, tenantId: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {
      host: seed.tenant.subdomain,
      'x-tenant-id': tenantId,
    },
    payload: {
      identifier: seed.administrator.username,
      password: seed.administrator.password,
    },
  });

  expect(response.statusCode).toBe(200);
  return response.json().accessToken as string;
}

describe('Customer authorization proof', () => {
  let pool: Pool | undefined;
  let adminPool: Pool | undefined;
  let app: Awaited<ReturnType<typeof createApplication>> | undefined;

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (pool) {
      await pool.end();
    }
    if (adminPool) {
      await adminPool.end();
    }
  });

  runIfDatabase('proves tenant isolation, module entitlement, permission checks, and RLS enforcement for Customer APIs', async () => {
    pool = createIntegrationApplicationPool();
    adminPool = createIntegrationAdminPool();
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    await platformBootstrapService.seedReferenceData();

    const uniqueSuffix = `${Date.now()}-${uuidV7()}`;
    const tenantASeed = buildTenantSeed('Customer Tenant A', uniqueSuffix, [
      'customer.read',
      'customer.create',
      'customer.update',
      'customer.delete',
      'branch.read',
    ]);
    const tenantBSeed = buildTenantSeed('Customer Tenant B', uniqueSuffix, [
      'customer.read',
      'customer.create',
      'customer.update',
      'customer.delete',
      'branch.read',
    ]);
    const missingPermissionSeed = buildTenantSeed('Customer Tenant C', uniqueSuffix, ['branch.read', 'user.read']);
    const moduleDisabledSeed = buildTenantSeed('Customer Tenant D', uniqueSuffix, [
      'customer.read',
      'customer.create',
      'customer.update',
      'customer.delete',
      'branch.read',
    ]);

    const tenantAResult = await tenantBootstrapService.bootstrapTenant(tenantASeed);
    const tenantBResult = await tenantBootstrapService.bootstrapTenant(tenantBSeed);
    const missingPermissionResult = await tenantBootstrapService.bootstrapTenant(missingPermissionSeed);
    const moduleDisabledResult = await tenantBootstrapService.bootstrapTenant(moduleDisabledSeed);

    const config = parseAppConfig({
      ...process.env,
      NODE_ENV: 'test',
      APP_NAME: 'new-erp-final',
      HOST: '127.0.0.1',
      PORT: '3001',
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

    const platformEmail = `customer-proof-platform-${Date.now()}-${uuidV7()}@example.com`;
    const platformPassword = 'CustomerProofPlatformPassword123!';
    const platformIdentity = await adminPool.query<{ id: string }>(
      `INSERT INTO identities (status) VALUES ('active') RETURNING id`,
    );
    const platformIdentityId = platformIdentity.rows[0].id;
    await adminPool.query(
      `INSERT INTO auth_login_identifiers
        (identifier_type, identifier, tenant_id, user_id, identity_id, is_active)
       VALUES ('email', $1::citext, NULL, NULL, $2, true)`,
      [platformEmail, platformIdentityId],
    );
    await adminPool.query(
      `INSERT INTO identity_credentials
        (identity_id, provider, credential_type, secret_hash, password_changed_at)
       VALUES ($1, 'local', 'password', $2, now())`,
      [platformIdentityId, await passwordHasher.hash(platformPassword)],
    );
    const platformMembership = await adminPool.query<{ id: string }>(
      `INSERT INTO platform_memberships (identity_id, status, activated_at)
       VALUES ($1, 'active', now()) RETURNING id`,
      [platformIdentityId],
    );
    const platformRole = await adminPool.query<{ id: string }>(
      `SELECT id FROM platform_roles WHERE code = 'platform_owner' AND is_system = true`,
    );
    expect(platformRole.rowCount).toBe(1);
    await adminPool.query(
      `INSERT INTO platform_membership_roles (platform_membership_id, platform_role_id)
       VALUES ($1, $2)`,
      [platformMembership.rows[0].id, platformRole.rows[0].id],
    );

    const unauthenticatedList = await app.inject({
      method: 'GET',
      url: '/api/v1/customers',
    });
    expect(unauthenticatedList.statusCode).toBe(401);

    const unauthenticatedCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/customers',
      payload: { name: 'Unauthenticated customer' },
    });
    expect(unauthenticatedCreate.statusCode).toBe(401);

    const platformLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/platform-login',
      payload: {
        identifier: platformEmail,
        password: platformPassword,
      },
    });
    expect(platformLogin.statusCode).toBe(200);
    const platformToken = platformLogin.json().accessToken as string;

    const platformCustomers = await app.inject({
      method: 'GET',
      url: '/api/v1/customers',
      headers: {
        authorization: `Bearer ${platformToken}`,
      },
    });
    expect(platformCustomers.statusCode).toBe(401);

    const tenantAToken = await loginTenant(app, tenantASeed, tenantAResult.tenantId);
    const tenantBToken = await loginTenant(app, tenantBSeed, tenantBResult.tenantId);
    const guestToken = await loginTenant(app, missingPermissionSeed, missingPermissionResult.tenantId);
    const moduleDisabledToken = await loginTenant(app, moduleDisabledSeed, moduleDisabledResult.tenantId);

    const missingPermissionResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/customers',
      headers: {
        authorization: `Bearer ${guestToken}`,
        'x-tenant-id': missingPermissionResult.tenantId,
      },
    });
    expect(missingPermissionResponse.statusCode).toBe(403);

    const listBeforeCreate = await app.inject({
      method: 'GET',
      url: '/api/v1/customers',
      headers: {
        authorization: `Bearer ${tenantAToken}`,
        'x-tenant-id': tenantAResult.tenantId,
      },
    });
    expect(listBeforeCreate.statusCode).toBe(200);

    const createCustomer = await app.inject({
      method: 'POST',
      url: '/api/v1/customers',
      headers: {
        authorization: `Bearer ${tenantAToken}`,
        'x-tenant-id': tenantAResult.tenantId,
      },
      payload: { name: `Customer ${uniqueSuffix}` },
    });
    expect(createCustomer.statusCode).toBe(201);
    const customer = createCustomer.json().customer;
    expect(customer.tenantId).toBe(tenantAResult.tenantId);

    const tenantAList = await app.inject({
      method: 'GET',
      url: '/api/v1/customers',
      headers: {
        authorization: `Bearer ${tenantAToken}`,
        'x-tenant-id': tenantAResult.tenantId,
      },
    });
    expect(tenantAList.statusCode).toBe(200);
    expect(tenantAList.json().customers.some((entry: { id: string }) => entry.id === customer.id)).toBe(true);

    const spoofedCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/customers',
      headers: {
        authorization: `Bearer ${tenantAToken}`,
        'x-tenant-id': tenantBResult.tenantId,
      },
      payload: { name: `Spoofed Customer ${uniqueSuffix}` },
    });
    expect(spoofedCreate.statusCode).toBe(201);
    expect(spoofedCreate.json().customer.tenantId).toBe(tenantAResult.tenantId);

    const tenantBGet = await app.inject({
      method: 'GET',
      url: `/api/v1/customers/${customer.id}`,
      headers: {
        authorization: `Bearer ${tenantBToken}`,
        'x-tenant-id': tenantBResult.tenantId,
      },
    });
    expect(tenantBGet.statusCode).toBe(404);

    const tenantBUpdate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/customers/${customer.id}`,
      headers: {
        authorization: `Bearer ${tenantBToken}`,
        'x-tenant-id': tenantBResult.tenantId,
      },
      payload: { name: 'Tenant B attack' },
    });
    expect(tenantBUpdate.statusCode).toBe(404);

    const tenantBDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/customers/${customer.id}`,
      headers: {
        authorization: `Bearer ${tenantBToken}`,
        'x-tenant-id': tenantBResult.tenantId,
      },
    });
    expect(tenantBDelete.statusCode).toBe(404);

    const tenantBList = await app.inject({
      method: 'GET',
      url: '/api/v1/customers',
      headers: {
        authorization: `Bearer ${tenantBToken}`,
        'x-tenant-id': tenantBResult.tenantId,
      },
    });
    expect(tenantBList.statusCode).toBe(200);
    expect(tenantBList.json().customers.some((entry: { id: string }) => entry.id === customer.id)).toBe(false);

    const crmModuleIdResult = await adminPool.query<{ id: string }>(`SELECT id FROM modules WHERE code = 'crm' LIMIT 1`);
    expect(crmModuleIdResult.rowCount).toBe(1);
    const crmModuleId = crmModuleIdResult.rows[0].id;
    const moduleDisabledTenantId = JSON.parse(
      Buffer.from(moduleDisabledToken.split('.')[1], 'base64url').toString('utf8'),
    ).tenantId as string;
    expect(moduleDisabledTenantId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    await adminPool.query(
      `UPDATE tenant_modules
       SET enabled = false, disabled_at = NOW(), disabled_by = NULL
       WHERE tenant_id = $1 AND module_id = $2`,
      [moduleDisabledTenantId, crmModuleId],
    );

    const moduleDisabledResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/customers',
      headers: {
        authorization: `Bearer ${moduleDisabledToken}`,
        'x-tenant-id': moduleDisabledTenantId,
      },
    });
    expect(moduleDisabledResponse.statusCode).toBe(403);

    const deleteCustomer = await app.inject({
      method: 'DELETE',
      url: `/api/v1/customers/${customer.id}`,
      headers: {
        authorization: `Bearer ${tenantAToken}`,
        'x-tenant-id': tenantAResult.tenantId,
      },
    });
    expect(deleteCustomer.statusCode).toBe(200);

    const deletedGet = await app.inject({
      method: 'GET',
      url: `/api/v1/customers/${customer.id}`,
      headers: {
        authorization: `Bearer ${tenantAToken}`,
        'x-tenant-id': tenantAResult.tenantId,
      },
    });
    expect(deletedGet.statusCode).toBe(404);

    const tenantAListAfterDelete = await app.inject({
      method: 'GET',
      url: '/api/v1/customers',
      headers: {
        authorization: `Bearer ${tenantAToken}`,
        'x-tenant-id': tenantAResult.tenantId,
      },
    });
    expect(tenantAListAfterDelete.statusCode).toBe(200);
    expect(tenantAListAfterDelete.json().customers.some((entry: { id: string }) => entry.id === customer.id)).toBe(false);

    const rlsTenantA = await withTenantContext(pool, 'app.current_tenant_id', tenantAResult.tenantId, async (client) =>
      client.query(
        `SELECT id FROM customers WHERE tenant_id = $1 AND id = $2 AND is_deleted = false`,
        [tenantAResult.tenantId, customer.id],
      ),
    );
    expect(rlsTenantA.rows).toHaveLength(0);

    const rlsTenantB = await withTenantContext(pool, 'app.current_tenant_id', tenantBResult.tenantId, async (client) =>
      client.query(
        `SELECT id FROM customers WHERE tenant_id = $1 AND id = $2 AND is_deleted = false`,
        [tenantAResult.tenantId, customer.id],
      ),
    );
    expect(rlsTenantB.rows).toHaveLength(0);

    await expect(
      pool.query(`SELECT id FROM customers WHERE tenant_id = $1 AND id = $2 AND is_deleted = false`, [
        tenantAResult.tenantId,
        customer.id,
      ]),
    ).rejects.toMatchObject({ code: '22P02' });
  });
});

import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { parseAppConfig, resolveDatabaseUrl } from '../../src/config/schema.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { createApplication } from '../../src/presentation/http/app.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });

describe('Authentication context sequencing', () => {
  let pool: Pool | undefined;
  let app: Awaited<ReturnType<typeof createApplication>> | undefined;

  afterAll(async () => {
    if (app) await app.close();
    if (pool) await pool.end();
  });

  it('requires organization context before exposing locations and establishes effective location context after selection', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);
    await platformBootstrapService.seedReferenceData();

    const suffix = `${Date.now()}-${uuidV7()}`;
    const tenantHost = `context-${suffix}`;
    const bootstrap = await tenantBootstrapService.bootstrapTenant({
      tenant: {
        name: `Context Tenant ${suffix}`,
        displayName: `Context Tenant ${suffix}`,
        subdomain: tenantHost,
        slug: `context-${suffix}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: {
        code: `CTX1${suffix}`.slice(0, 18),
        name: `Context Organization 1 ${suffix}`,
      },
      branch: {
        code: `CTXB1${suffix}`.slice(0, 15),
        name: `Context Branch 1 ${suffix}`,
        city: 'Pune',
        country: 'IN',
      },
      administrator: {
        username: `context${suffix}`,
        email: `context${suffix}@example.com`,
        password: 'Password123!',
      },
      role: {
        code: `context-admin-${suffix}`.slice(0, 40),
        name: 'Context Administrator',
      },
      permissions: ['organization.read', 'branch.read', 'role.read', 'permission.read'],
      subscriptionPlanName: 'Starter',
    });

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

    const organizationTwo = await repository.createOrganization(bootstrap.tenantId, {
      code: `CTX2${suffix}`.slice(0, 18),
      name: `Context Organization 2 ${suffix}`,
      isDefault: false,
    });
    await repository.assignUserToOrganization(bootstrap.tenantId, bootstrap.userId, organizationTwo.id);
    const branchTwo = await repository.createBranch(bootstrap.tenantId, organizationTwo.id, {
      code: `CTXB2${suffix}`.slice(0, 15),
      name: `Context Branch 2 ${suffix}`,
      city: 'Mumbai',
      country: 'IN',
      isDefault: true,
    });
    await repository.assignUserToBranch(bootstrap.tenantId, bootstrap.userId, branchTwo.id);
    const locationTwo = await repository.createLocation(bootstrap.tenantId, organizationTwo.id, {
      code: `LOC2${suffix}`.slice(0, 18),
      name: `Context Location 2 ${suffix}`,
      city: 'Mumbai',
      country: 'IN',
      isDefault: true,
    });

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: tenantHost, 'x-tenant-id': bootstrap.tenantId },
      payload: { identifier: `context${suffix}`, password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const loginBody = login.json();
    expect(loginBody.session.organizationId).toBeNull();

    const token = loginBody.accessToken as string;
    const organizations = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/organizations',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': bootstrap.tenantId },
    });
    expect(organizations.statusCode).toBe(200);
    expect(organizations.json().requiresOrganizationSelection).toBe(true);
    expect(organizations.json().activeOrganizationId).toBeNull();

    const locationsBeforeOrganization = await app.inject({
      method: 'GET',
      url: '/api/v1/locations',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': bootstrap.tenantId },
    });
    expect(locationsBeforeOrganization.statusCode).toBe(200);
    expect(locationsBeforeOrganization.json().locations).toEqual([]);

    const organizationSelection = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/organizations/select',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': bootstrap.tenantId },
      payload: { organizationId: organizationTwo.id },
    });
    expect(organizationSelection.statusCode).toBe(200);
    const organizationSelectionBody = organizationSelection.json();
    expect(organizationSelectionBody.session.organizationId).toBe(organizationTwo.id);

    const organizationToken = organizationSelectionBody.accessToken as string;
    const locationsAfterOrganization = await app.inject({
      method: 'GET',
      url: '/api/v1/locations',
      headers: { authorization: `Bearer ${organizationToken}`, 'x-tenant-id': bootstrap.tenantId },
    });
    expect(locationsAfterOrganization.statusCode).toBe(200);
    expect(locationsAfterOrganization.json().locations.map((location: { id: string }) => location.id)).toContain(locationTwo.id);

    const locationSelection = await app.inject({
      method: 'POST',
      url: `/api/v1/locations/${locationTwo.id}/select`,
      headers: { authorization: `Bearer ${organizationToken}`, 'x-tenant-id': bootstrap.tenantId },
    });
    expect(locationSelection.statusCode).toBe(200);
    expect(locationSelection.json().session.organizationId).toBe(organizationTwo.id);
    expect(locationSelection.json().session.locationId).toBe(locationTwo.id);
  });
});
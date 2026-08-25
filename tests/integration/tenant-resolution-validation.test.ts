import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { parseAppConfig } from '../../src/config/schema.js';
import { createApplication } from '../../src/presentation/http/app.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = it; // tests run only when TEST_DATABASE_URL present

describe('Tenant resolution end-to-end (bootstrap → login) under development strategy', () => {
  let pool: Pool | undefined;
  let app: Awaited<ReturnType<typeof createApplication>> | undefined;

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (pool) {
      await pool.end();
    }
  });

  runIfDatabase('resolves tenant via TENANT_HOST_MAP and allows login for the created tenant', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    const unique = `${Date.now()}-${uuidV7()}`;
    const tenantInput = {
      tenant: {
        name: `ResolveTenant ${unique}`,
        displayName: `ResolveTenant ${unique}`,
        subdomain: `resolve-${unique}`,
        slug: `resolve-${unique}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: {
        code: `RES${unique}`.slice(0, 18),
        name: `Resolve Org ${unique}`,
        fiscalCalendar: 'standard',
      },
      branch: {
        code: `BR${unique}`.slice(0, 15),
        name: `Resolve Branch ${unique}`,
        city: 'Bengaluru',
        country: 'IN',
      },
      administrator: {
        username: `admin${unique}`,
        email: `admin${unique}@example.com`,
        password: 'Password123!',
      },
      role: {
        code: `resadmin${unique}`.slice(0, 20),
        name: `Resolve Admin ${unique}`,
      },
      permissions: ['role.manage', 'user.manage', 'session.manage', 'organization.manage', 'branch.manage'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: {
        name: `FY-${unique}`,
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
    } as any;

    const tenantResult = await tenantBootstrapService.bootstrapTenant(tenantInput);
    const host = tenantInput.tenant.subdomain;

    // Map host to tenant via TENANT_HOST_MAP
    const hostMap = JSON.stringify({ [host]: tenantResult.tenantId });

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
      TENANT_HOST_MAP: hostMap,
      TENANT_RESOLUTION_MODE: 'development',
    });

    app = await createApplication(config, pool);

    // GET /bootstrap should resolve tenant from host
    const bootstrapResp = await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { host } });
    expect(bootstrapResp.statusCode).toBe(200);
    const bootstrapJson = bootstrapResp.json();
    expect(bootstrapJson.deployment.tenantId).toBe(tenantResult.tenantId);

    // Login must resolve tenant server-side (header is allowed but checked)
    const loginResp = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host },
      payload: { identifier: tenantInput.administrator.username, password: tenantInput.administrator.password },
    });

    expect(loginResp.statusCode).toBe(200);
    const loginJson = loginResp.json();
    expect(loginJson.user.email).toBe(tenantInput.administrator.email);
    expect(loginJson.session.tenantId).toBe(tenantResult.tenantId);
  });
});

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
const runIfDatabase = it;

describe('GET /rbac/roles/:roleId/permissions', () => {
  let pool: Pool | undefined;
  let app: Awaited<ReturnType<typeof createApplication>> | undefined;

  afterAll(async () => {
    if (app) await app.close();
    if (pool) await pool.end();
  });

  runIfDatabase('returns assigned permissions for a role for authorized user and tenant', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    await platformBootstrapService.seedReferenceData();

    const unique = `${Date.now()}-${uuidV7()}`;
    const tenantInput = {
      tenant: {
        name: `RBAC Test ${unique}`,
        displayName: `RBAC Test ${unique}`,
        subdomain: `rbac-${unique}`,
        slug: `rbac-${unique}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: { code: `R${unique}`.slice(0, 18), name: `Org ${unique}`, fiscalCalendar: 'standard' },
      branch: { code: `B${unique}`.slice(0, 15), name: `Branch ${unique}`, city: 'City', country: 'IN' },
      administrator: { username: `admin${unique}`, email: `admin${unique}@example.com`, password: 'Password123!' },
      role: { code: `admin${unique}`.slice(0, 20), name: `Admin ${unique}` },
      permissions: ['role.manage', 'permission.read', 'role.read'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: { name: `FY-${unique}`, startDate: '2026-04-01', endDate: '2027-03-31' },
    };

    const tenantResult = await tenantBootstrapService.bootstrapTenant(tenantInput);

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

    // login admin to obtain token
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: tenantInput.tenant.subdomain, 'x-tenant-id': tenantResult.tenantId },
      payload: { identifier: tenantInput.administrator.username, password: tenantInput.administrator.password },
    });
    expect(adminLogin.statusCode).toBe(200);
    const adminToken = adminLogin.json().accessToken;

    // create a new role
    const roleCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/rbac/roles',
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-id': tenantResult.tenantId },
      payload: { code: 'analyst', name: 'Analyst' },
    });
    expect(roleCreate.statusCode).toBe(200);
    const role = roleCreate.json().role;

    // assign a permission
    const assignResp = await app.inject({
      method: 'POST',
      url: `/api/v1/rbac/roles/${role.id}/permissions`,
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-id': tenantResult.tenantId },
      payload: { permissionKeys: ['permission.read'] },
    });
    expect(assignResp.statusCode).toBe(200);

    // GET assigned permissions
    const getResp = await app.inject({
      method: 'GET',
      url: `/api/v1/rbac/roles/${role.id}/permissions`,
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-id': tenantResult.tenantId },
    });
    expect(getResp.statusCode).toBe(200);
    const perms = getResp.json().permissions as Array<any>;
    expect(perms.some((p) => p.permissionKey === 'permission.read')).toBe(true);
  });

  runIfDatabase('rejects unauthenticated requests with 401', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    await platformBootstrapService.seedReferenceData();

    const unique = `${Date.now()}-${uuidV7()}`;
    const tenantInput = {
      tenant: {
        name: `RBAC UAT ${unique}`,
        displayName: `RBAC UAT ${unique}`,
        subdomain: `rbac-uat-${unique}`,
        slug: `rbac-uat-${unique}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: { code: `RU${unique}`.slice(0, 18), name: `Org U ${unique}`, fiscalCalendar: 'standard' },
      branch: { code: `RB${unique}`.slice(0, 15), name: `Branch U ${unique}`, city: 'City', country: 'IN' },
      administrator: { username: `adminu${unique}`, email: `adminu${unique}@example.com`, password: 'Password123!' },
      role: { code: `adminu${unique}`.slice(0, 20), name: `Admin U ${unique}` },
      permissions: ['role.manage'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: { name: `FYU-${unique}`, startDate: '2026-04-01', endDate: '2027-03-31' },
    };

    const tenantResult = await tenantBootstrapService.bootstrapTenant(tenantInput);

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

    // create role as admin (but we will call GET unauthenticated)
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: tenantInput.tenant.subdomain, 'x-tenant-id': tenantResult.tenantId },
      payload: { identifier: tenantInput.administrator.username, password: tenantInput.administrator.password },
    });
    expect(adminLogin.statusCode).toBe(200);
    const adminToken = adminLogin.json().accessToken;

    const roleCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/rbac/roles',
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-id': tenantResult.tenantId },
      payload: { code: 'viewer', name: 'Viewer' },
    });
    expect(roleCreate.statusCode).toBe(200);
    const role = roleCreate.json().role;

    const unauth = await app.inject({
      method: 'GET',
      url: `/api/v1/rbac/roles/${role.id}/permissions`,
      headers: { 'x-tenant-id': tenantResult.tenantId },
    });
    expect(unauth.statusCode).toBe(401);
  });

  runIfDatabase('returns 403 for authenticated user without role.manage', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    await platformBootstrapService.seedReferenceData();

    const unique = `${Date.now()}-${uuidV7()}`;
    const tenantInput = {
      tenant: {
        name: `RBAC F ${unique}`,
        displayName: `RBAC F ${unique}`,
        subdomain: `rbac-f-${unique}`,
        slug: `rbac-f-${unique}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: { code: `RF${unique}`.slice(0, 18), name: `Org F ${unique}`, fiscalCalendar: 'standard' },
      branch: { code: `RBF${unique}`.slice(0, 15), name: `Branch F ${unique}`, city: 'City', country: 'IN' },
      administrator: { username: `adminf${unique}`, email: `adminf${unique}@example.com`, password: 'Password123!' },
      role: { code: `adminf${unique}`.slice(0, 20), name: `Admin F ${unique}` },
      permissions: ['role.manage', 'user.manage', 'permission.read'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: { name: `FYF-${unique}`, startDate: '2026-04-01', endDate: '2027-03-31' },
    };

    const tenantResult = await tenantBootstrapService.bootstrapTenant(tenantInput);

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

    // register a user that does NOT have role.manage
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: tenantInput.tenant.subdomain, 'x-tenant-id': tenantResult.tenantId },
      payload: { identifier: tenantInput.administrator.username, password: tenantInput.administrator.password },
    });
    expect(adminLogin.statusCode).toBe(200);
    const adminToken = adminLogin.json().accessToken;

    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-id': tenantResult.tenantId },
      payload: {
        username: `user${unique}`,
        email: `user${unique}@example.com`,
        password: 'Password456!',
        roleCode: 'member',
      },
    });
    expect(reg.statusCode === 201 || reg.statusCode === 200).toBeTruthy();
    const user = reg.json().user;

    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: tenantInput.tenant.subdomain, 'x-tenant-id': tenantResult.tenantId },
      payload: { identifier: user.username, password: 'Password456!' },
    });
    expect(userLogin.statusCode).toBe(200);
    const userToken = userLogin.json().accessToken;

    // create a role as admin and assign permission
    const roleCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/rbac/roles',
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-id': tenantResult.tenantId },
      payload: { code: 'auditor', name: 'Auditor' },
    });
    expect(roleCreate.statusCode).toBe(200);
    const role = roleCreate.json().role;

    const assignResp = await app.inject({
      method: 'POST',
      url: `/api/v1/rbac/roles/${role.id}/permissions`,
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-id': tenantResult.tenantId },
      payload: { permissionKeys: ['permission.read'] },
    });
    expect(assignResp.statusCode).toBe(200);

    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/v1/rbac/roles/${role.id}/permissions`,
      headers: { authorization: `Bearer ${userToken}`, 'x-tenant-id': tenantResult.tenantId },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  runIfDatabase('enforces tenant isolation: does not leak other tenant permissions', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    await platformBootstrapService.seedReferenceData();

    const unique = `${Date.now()}-${uuidV7()}`;
    const tenantA = {
      tenant: {
        name: `TA ${unique}`,
        displayName: `TA ${unique}`,
        subdomain: `ta-${unique}`,
        slug: `ta-${unique}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: { code: `TA${unique}`.slice(0, 18), name: `TA Org ${unique}`, fiscalCalendar: 'standard' },
      branch: { code: `TAB${unique}`.slice(0, 15), name: `TA Branch ${unique}`, city: 'City', country: 'IN' },
      administrator: { username: `adminta${unique}`, email: `adminta${unique}@example.com`, password: 'Password123!' },
      role: { code: `adminta${unique}`.slice(0, 20), name: `Admin TA ${unique}` },
      permissions: ['role.manage', 'permission.read'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: { name: `FYA-${unique}`, startDate: '2026-04-01', endDate: '2027-03-31' },
    };

    const tenantB = {
      tenant: {
        name: `TB ${unique}`,
        displayName: `TB ${unique}`,
        subdomain: `tb-${unique}`,
        slug: `tb-${unique}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: { code: `TB${unique}`.slice(0, 18), name: `TB Org ${unique}`, fiscalCalendar: 'standard' },
      branch: { code: `TBB${unique}`.slice(0, 15), name: `TB Branch ${unique}`, city: 'City', country: 'IN' },
      administrator: { username: `admintb${unique}`, email: `admintb${unique}@example.com`, password: 'Password123!' },
      role: { code: `admintb${unique}`.slice(0, 20), name: `Admin TB ${unique}` },
      permissions: ['role.manage', 'permission.read'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: { name: `FYB-${unique}`, startDate: '2026-04-01', endDate: '2027-03-31' },
    };

    const resA = await tenantBootstrapService.bootstrapTenant(tenantA);
    const resB = await tenantBootstrapService.bootstrapTenant(tenantB);

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

    // admin A login
    const adminALogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: tenantA.tenant.subdomain, 'x-tenant-id': resA.tenantId },
      payload: { identifier: tenantA.administrator.username, password: tenantA.administrator.password },
    });
    expect(adminALogin.statusCode).toBe(200);
    const tokenA = adminALogin.json().accessToken;

    // admin B login
    const adminBLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: tenantB.tenant.subdomain, 'x-tenant-id': resB.tenantId },
      payload: { identifier: tenantB.administrator.username, password: tenantB.administrator.password },
    });
    expect(adminBLogin.statusCode).toBe(200);
    const tokenB = adminBLogin.json().accessToken;

    // create role in tenant A and assign permission 'permission.read'
    const roleAResp = await app.inject({
      method: 'POST',
      url: '/api/v1/rbac/roles',
      headers: { authorization: `Bearer ${tokenA}`, 'x-tenant-id': resA.tenantId },
      payload: { code: 'role-a', name: 'Role A' },
    });
    expect(roleAResp.statusCode).toBe(200);
    const roleA = roleAResp.json().role;
    await app.inject({
      method: 'POST',
      url: `/api/v1/rbac/roles/${roleA.id}/permissions`,
      headers: { authorization: `Bearer ${tokenA}`, 'x-tenant-id': resA.tenantId },
      payload: { permissionKeys: ['permission.read'] },
    });

    // create role in tenant B and assign different permission 'role.read'
    const roleBResp = await app.inject({
      method: 'POST',
      url: '/api/v1/rbac/roles',
      headers: { authorization: `Bearer ${tokenB}`, 'x-tenant-id': resB.tenantId },
      payload: { code: 'role-b', name: 'Role B' },
    });
    expect(roleBResp.statusCode).toBe(200);
    const roleB = roleBResp.json().role;
    await app.inject({
      method: 'POST',
      url: `/api/v1/rbac/roles/${roleB.id}/permissions`,
      headers: { authorization: `Bearer ${tokenB}`, 'x-tenant-id': resB.tenantId },
      payload: { permissionKeys: ['role.read'] },
    });

    // Now request tenant A role permissions while authenticated as admin A
    const getA = await app.inject({
      method: 'GET',
      url: `/api/v1/rbac/roles/${roleA.id}/permissions`,
      headers: { authorization: `Bearer ${tokenA}`, 'x-tenant-id': resA.tenantId },
    });
    expect(getA.statusCode).toBe(200);
    const permsA = getA.json().permissions as Array<any>;
    expect(permsA.some((p) => p.permissionKey === 'permission.read')).toBe(true);
    expect(permsA.some((p) => p.permissionKey === 'role.read')).toBe(false);

    // Ensure tenant A cannot see tenant B's permissions by attempting to GET roleB with tenant A token
    const getBfromA = await app.inject({
      method: 'GET',
      url: `/api/v1/rbac/roles/${roleB.id}/permissions`,
      headers: { authorization: `Bearer ${tokenA}`, 'x-tenant-id': resA.tenantId },
    });
    // Implementation may return 404 or 200 with empty list; accept either
    expect([200, 404]).toContain(getBfromA.statusCode);
    if (getBfromA.statusCode === 200) {
      expect((getBfromA.json().permissions as Array<any>).length).toBe(0);
    }
  });

  runIfDatabase('returns empty list for unknown/nonexistent role', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    await platformBootstrapService.seedReferenceData();

    const unique = `${Date.now()}-${uuidV7()}`;
    const tenantInput = {
      tenant: {
        name: `RBAC NX ${unique}`,
        displayName: `RBAC NX ${unique}`,
        subdomain: `rbac-nx-${unique}`,
        slug: `rbac-nx-${unique}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: { code: `RNX${unique}`.slice(0, 18), name: `Org NX ${unique}`, fiscalCalendar: 'standard' },
      branch: { code: `RNB${unique}`.slice(0, 15), name: `Branch NX ${unique}`, city: 'City', country: 'IN' },
      administrator: { username: `adminnx${unique}`, email: `adminnx${unique}@example.com`, password: 'Password123!' },
      role: { code: `adminnx${unique}`.slice(0, 20), name: `Admin NX ${unique}` },
      permissions: ['role.manage'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: { name: `FYNX-${unique}`, startDate: '2026-04-01', endDate: '2027-03-31' },
    };

    const tenantResult = await tenantBootstrapService.bootstrapTenant(tenantInput);

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

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: tenantInput.tenant.subdomain, 'x-tenant-id': tenantResult.tenantId },
      payload: { identifier: tenantInput.administrator.username, password: tenantInput.administrator.password },
    });
    expect(adminLogin.statusCode).toBe(200);
    const token = adminLogin.json().accessToken;

    const unknownId = '00000000-0000-4000-8000-000000000000';
    const resp = await app.inject({
      method: 'GET',
      url: `/api/v1/rbac/roles/${unknownId}/permissions`,
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': tenantResult.tenantId },
    });
    expect(resp.statusCode).toBe(200);
    expect(Array.isArray(resp.json().permissions)).toBe(true);
    expect(resp.json().permissions.length).toBe(0);
  });
});

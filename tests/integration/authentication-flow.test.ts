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

describe('Authentication vertical slice', () => {
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

  runIfDatabase('implements register-login-me-refresh-logout protected access flow', async () => {
    pool = new Pool({ connectionString: databaseUrl! });

    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    await platformBootstrapService.seedReferenceData();

    const uniqueSuffix = `${Date.now()}-${uuidV7()}`;
    const tenantInput = {
      tenant: {
        name: `Auth Tenant ${uniqueSuffix}`,
        displayName: `Auth Tenant ${uniqueSuffix}`,
        subdomain: `auth-${uniqueSuffix}`,
        slug: `auth-${uniqueSuffix}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: {
        code: `AUTH${uniqueSuffix}`.slice(0, 18),
        name: `Auth Org ${uniqueSuffix}`,
        fiscalCalendar: 'standard',
      },
      branch: {
        code: `BR${uniqueSuffix}`.slice(0, 15),
        name: `Auth Branch ${uniqueSuffix}`,
        city: 'Bengaluru',
        country: 'IN',
      },
      administrator: {
        username: `admin${uniqueSuffix}`,
        email: `admin${uniqueSuffix}@example.com`,
        password: 'Password123!',
      },
      role: {
        code: `authadmin${uniqueSuffix}`.slice(0, 20),
        name: `Auth Admin ${uniqueSuffix}`,
      },
      permissions: ['role.manage', 'user.manage', 'session.manage', 'organization.manage', 'branch.manage'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: {
        name: `FY-${uniqueSuffix}`,
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
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

    const tenantHost = tenantInput.tenant.subdomain;

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: tenantInput.administrator.username, password: tenantInput.administrator.password },
    });

    expect(adminLogin.statusCode).toBe(200);
    const adminJson = adminLogin.json();
    expect(adminJson.accessToken).toBeTruthy();
    expect(adminJson.refreshToken).toBeTruthy();
    expect(adminJson.user.email).toBe(tenantInput.administrator.email);

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: {
        authorization: `Bearer ${adminJson.accessToken}`,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'Password456!',
        roleCode: 'member',
      },
    });

    expect(registerResponse.statusCode).toBe(201);
    expect(registerResponse.json().user.email).toBe('newuser@example.com');

    const duplicateRegister = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: {
        authorization: `Bearer ${adminJson.accessToken}`,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'Password456!',
      },
    });
    expect(duplicateRegister.statusCode).toBe(400);

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: 'newuser', password: 'Password456!' },
    });

    expect(loginResponse.statusCode).toBe(200);
    const loginJson = loginResponse.json();
    expect(loginJson.user.username).toBe('newuser');
    expect(loginJson.accessToken).toBeTruthy();
    expect(loginJson.refreshToken).toBeTruthy();
    expect(JSON.stringify(loginJson)).not.toContain('password_hash');
    expect(JSON.stringify(loginJson)).not.toContain('Password456!');

    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${loginJson.accessToken}` },
    });
    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json().user.username).toBe('newuser');

    const protectedResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/protected',
      headers: { authorization: `Bearer ${loginJson.accessToken}` },
    });
    expect(protectedResponse.statusCode).toBe(200);

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: loginJson.refreshToken },
    });
    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.json().accessToken).toBeTruthy();

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${loginJson.accessToken}` },
    });
    expect(logoutResponse.statusCode).toBe(200);

    const afterLogout = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/protected',
      headers: { authorization: `Bearer ${loginJson.accessToken}` },
    });
    expect(afterLogout.statusCode).toBe(401);

    const unauthenticated = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(unauthenticated.statusCode).toBe(401);

    const badToken = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: 'Bearer bad.token.here' },
    });
    expect(badToken.statusCode).toBe(401);

    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: 'newuser', password: 'WrongPassword!' },
    });
    expect(wrongPassword.statusCode).toBe(401);

    const unknownUser = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: 'ghost-user', password: 'Password123!' },
    });
    expect(unknownUser.statusCode).toBe(401);
  });

  runIfDatabase('rejects authentication for inactive users', async () => {
    if (!pool) {
      pool = new Pool({ connectionString: databaseUrl! });
    }

    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    await platformBootstrapService.seedReferenceData();

    const uniqueSuffix = `${Date.now()}-${uuidV7()}-inactive`;
    const tenantInput = {
      tenant: {
        name: `Inactive Test Tenant ${uniqueSuffix}`,
        displayName: `Inactive Test Tenant ${uniqueSuffix}`,
        subdomain: `inactive-${uniqueSuffix}`,
        slug: `inactive-${uniqueSuffix}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: {
        code: `INACT${uniqueSuffix}`.slice(0, 18),
        name: `Inactive Org ${uniqueSuffix}`,
        fiscalCalendar: 'standard',
      },
      branch: {
        code: `BR${uniqueSuffix}`.slice(0, 15),
        name: `Inactive Branch ${uniqueSuffix}`,
        city: 'Bengaluru',
        country: 'IN',
      },
      administrator: {
        username: `inactadmin${uniqueSuffix}`.slice(0, 20),
        email: `inactadmin${uniqueSuffix}@example.com`,
        password: 'Password123!',
      },
      role: {
        code: `inactadmin${uniqueSuffix}`.slice(0, 20),
        name: `Inactive Admin ${uniqueSuffix}`,
      },
      permissions: ['user.manage'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: {
        name: `FY-${uniqueSuffix}`,
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
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

    if (!app) {
      app = await createApplication(config, pool);
    }

    // Create a test user
    const testUserId = uuidV7();
    const testUser = await repository.createUser({
      id: testUserId,
      tenantId: tenantResult.tenantId,
      organizationId: tenantResult.organizationId,
      defaultBranchId: tenantResult.branchId,
      username: 'inactiveuser',
      email: 'inactiveuser@example.com',
      passwordHash: await passwordHasher.hash('Password789!'),
      status: 'active',
    });

    const tenantHost = tenantInput.tenant.subdomain;

    // Verify the user can authenticate
    const firstLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: testUser.username, password: 'Password789!' },
    });
    expect(firstLogin.statusCode).toBe(200);

    // Mark the user as inactive
    await repository.updateUserStatus(tenantResult.tenantId, testUserId, 'inactive');

    // Attempt to login again - should fail
    const inactiveLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: testUser.username, password: 'Password789!' },
    });
    expect(inactiveLogin.statusCode).toBe(401);
    expect(inactiveLogin.json().error.message).toBe('Invalid credentials.');
  });

  runIfDatabase('rejects authentication for deleted users', async () => {
    if (!pool) {
      pool = new Pool({ connectionString: databaseUrl! });
    }

    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    await platformBootstrapService.seedReferenceData();

    const uniqueSuffix = `${Date.now()}-${uuidV7()}-deleted`;
    const tenantInput = {
      tenant: {
        name: `Deleted Test Tenant ${uniqueSuffix}`,
        displayName: `Deleted Test Tenant ${uniqueSuffix}`,
        subdomain: `deleted-${uniqueSuffix}`,
        slug: `deleted-${uniqueSuffix}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: {
        code: `DELT${uniqueSuffix}`.slice(0, 18),
        name: `Deleted Org ${uniqueSuffix}`,
        fiscalCalendar: 'standard',
      },
      branch: {
        code: `BR${uniqueSuffix}`.slice(0, 15),
        name: `Deleted Branch ${uniqueSuffix}`,
        city: 'Bengaluru',
        country: 'IN',
      },
      administrator: {
        username: `deltadmin${uniqueSuffix}`.slice(0, 20),
        email: `deltadmin${uniqueSuffix}@example.com`,
        password: 'Password123!',
      },
      role: {
        code: `deltadmin${uniqueSuffix}`.slice(0, 20),
        name: `Deleted Admin ${uniqueSuffix}`,
      },
      permissions: ['user.manage'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: {
        name: `FY-${uniqueSuffix}`,
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
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

    if (!app) {
      app = await createApplication(config, pool);
    }

    // Create a test user
    const testUserId = uuidV7();
    const testUser = await repository.createUser({
      id: testUserId,
      tenantId: tenantResult.tenantId,
      organizationId: tenantResult.organizationId,
      defaultBranchId: tenantResult.branchId,
      username: 'deleteduser',
      email: 'deleteduser@example.com',
      passwordHash: await passwordHasher.hash('PasswordDel!'),
      status: 'active',
    });

    const tenantHost = tenantInput.tenant.subdomain;

    // Verify the user can authenticate with username
    const usernameLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: testUser.username, password: 'PasswordDel!' },
    });
    expect(usernameLogin.statusCode).toBe(200);

    // Verify the user can authenticate with email
    const emailLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: testUser.email, password: 'PasswordDel!' },
    });
    expect(emailLogin.statusCode).toBe(200);

    // Soft-delete the user
    await repository.softDeleteUser(tenantResult.tenantId, testUserId);

    // Attempt to login with username - should fail
    const deletedUsernameLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: testUser.username, password: 'PasswordDel!' },
    });
    expect(deletedUsernameLogin.statusCode).toBe(401);
    expect(deletedUsernameLogin.json().error.message).toBe('Invalid credentials.');

    // Attempt to login with email - should fail
    const deletedEmailLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: testUser.email, password: 'PasswordDel!' },
    });
    expect(deletedEmailLogin.statusCode).toBe(401);
    expect(deletedEmailLogin.json().error.message).toBe('Invalid credentials.');
  });
});

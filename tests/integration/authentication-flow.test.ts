import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';
import { createHash, randomBytes } from 'node:crypto';

import { parseAppConfig, resolveDatabaseUrl } from '../../src/config/schema.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { createApplication } from '../../src/presentation/http/app.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';

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
    const newUserUsername = `newuser${uniqueSuffix}`;
    const newUserEmail = `${newUserUsername}@example.com`;

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
    const loginAudit = await withTenantContext(pool, 'app.current_tenant_id', tenantResult.tenantId, (client) =>
      client.query(
        `SELECT action, outcome, correlation_id, metadata
         FROM audit_events
         WHERE tenant_id = $1 AND action = 'auth.login.success'
         ORDER BY created_at DESC
         LIMIT 1`,
        [tenantResult.tenantId],
      ),
    );
    expect(loginAudit.rows[0]).toMatchObject({ action: 'auth.login.success', outcome: 'success' });
    expect(loginAudit.rows[0].metadata).not.toHaveProperty('password');
    expect(loginAudit.rows[0].metadata).not.toHaveProperty('refreshToken');

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: {
        authorization: `Bearer ${adminJson.accessToken}`,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: {
        username: newUserUsername,
        email: newUserEmail,
        password: 'Password456!',
        roleCode: 'member',
      },
    });

    expect(registerResponse.statusCode).toBe(201);
    expect(registerResponse.json().user.email).toBe(newUserEmail);

    const duplicateRegister = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: {
        authorization: `Bearer ${adminJson.accessToken}`,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: {
        username: newUserUsername,
        email: newUserEmail,
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
      payload: { identifier: newUserUsername, password: 'Password456!' },
    });

    expect(loginResponse.statusCode).toBe(200);
    const loginJson = loginResponse.json();
    expect(loginJson.user.username).toBe(newUserUsername);
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
    expect(meResponse.json().user.username).toBe(newUserUsername);

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

    const recoveryRequest = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-recovery/request',
      headers: { 'x-correlation-id': 'recovery-correlation' },
      payload: { identifier: newUserEmail },
    });
    expect(recoveryRequest.statusCode).toBe(200);
    const recoveryAudit = await withTenantContext(pool, 'app.current_tenant_id', tenantResult.tenantId, (client) =>
      client.query(
        `SELECT action, outcome, actor_user_id, correlation_id, metadata
         FROM audit_events
         WHERE tenant_id = $1 AND action = 'auth.password_recovery.request'
         ORDER BY created_at DESC
         LIMIT 1`,
        [tenantResult.tenantId],
      ),
    );
    expect(recoveryAudit.rows[0]).toMatchObject({
      action: 'auth.password_recovery.request',
      outcome: 'success',
      actor_user_id: expect.any(String),
      correlation_id: 'recovery-correlation',
    });
    expect(JSON.stringify(recoveryAudit.rows[0].metadata)).not.toMatch(/password|token|secret|credential/i);

    const tenantBInput = {
      tenant: {
        name: `Header Boundary Tenant ${uniqueSuffix}`,
        displayName: `Header Boundary Tenant ${uniqueSuffix}`,
        subdomain: `header-boundary-${uniqueSuffix}`,
        slug: `header-boundary-${uniqueSuffix}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: { code: `HB${uniqueSuffix}`.slice(0, 18), name: 'Header Boundary Org' },
      branch: { code: `HBB${uniqueSuffix}`.slice(0, 15), name: 'Header Boundary Branch' },
      administrator: {
        username: `header-boundary-${uniqueSuffix}`,
        email: `header-boundary-${uniqueSuffix}@example.com`,
        password: 'Password123!',
      },
      role: { code: `hbadmin${uniqueSuffix}`.slice(0, 20), name: 'Header Boundary Admin' },
      permissions: ['user.manage'],
    };
    const tenantBResult = await tenantBootstrapService.bootstrapTenant(tenantBInput);
    const wrongHeaderToken = `wrong-header-${randomBytes(24).toString('base64url')}`;
    await withTenantContext(pool, 'app.current_tenant_id', tenantResult.tenantId, (client) =>
      client.query(
        `INSERT INTO password_reset_tokens (tenant_id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
        [tenantResult.tenantId, tenantResult.userId, createHash('sha256').update(wrongHeaderToken).digest('hex')],
      ),
    );
    const wrongHeaderReset = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-recovery/reset',
      headers: { 'x-tenant-id': tenantBResult.tenantId },
      payload: { token: wrongHeaderToken, newPassword: 'Password789!' },
    });
    expect(wrongHeaderReset.statusCode).toBe(401);

    const correctHeaderToken = `correct-header-${randomBytes(24).toString('base64url')}`;
    await withTenantContext(pool, 'app.current_tenant_id', tenantResult.tenantId, (client) =>
      client.query(
        `INSERT INTO password_reset_tokens (tenant_id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
        [tenantResult.tenantId, tenantResult.userId, createHash('sha256').update(correctHeaderToken).digest('hex')],
      ),
    );
    const correctHeaderReset = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-recovery/reset',
      headers: { 'x-tenant-id': tenantResult.tenantId },
      payload: { token: correctHeaderToken, newPassword: 'Password789!' },
    });
    expect(correctHeaderReset.statusCode).toBe(200);

    const missingHeader = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-recovery/reset',
      payload: { token: correctHeaderToken, newPassword: 'Password789!' },
    });
    expect(missingHeader.statusCode).toBe(400);
    const malformedHeader = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-recovery/reset',
      headers: { 'x-tenant-id': 'not-a-uuid' },
      payload: { token: correctHeaderToken, newPassword: 'Password789!' },
    });
    expect(malformedHeader.statusCode).toBe(400);

    const authenticatedHeaderOverride = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${loginJson.accessToken}`,
        'x-tenant-id': tenantBResult.tenantId,
      },
    });
    expect(authenticatedHeaderOverride.statusCode).toBe(200);
    expect(authenticatedHeaderOverride.json().user.tenantId).toBe(tenantResult.tenantId);

    const concurrentLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: newUserEmail, password: 'Password456!' },
    });
    expect(concurrentLogin.statusCode).toBe(200);
    const concurrentLoginJson = concurrentLogin.json();
    const concurrentRefresh = await Promise.all(
      [1, 2].map(() =>
        app!.inject({
          method: 'POST',
          url: '/api/v1/auth/refresh',
          payload: { refreshToken: concurrentLoginJson.refreshToken },
        }),
      ),
    );
    expect(concurrentRefresh.filter((response) => response.statusCode === 200)).toHaveLength(1);
    expect(concurrentRefresh.filter((response) => response.statusCode === 401)).toHaveLength(1);
    expect(concurrentRefresh.some((response) => response.statusCode === 500)).toBe(false);
    const winningRefresh = concurrentRefresh.find((response) => response.statusCode === 200);
    expect(winningRefresh?.json().refreshToken).toBeTruthy();
    expect(concurrentRefresh.find((response) => response.statusCode === 401)?.json().refreshToken).toBeUndefined();
    const replayedRefresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: concurrentLoginJson.refreshToken },
    });
    expect(replayedRefresh.statusCode).toBe(401);
    const revokedConcurrentSession = await withTenantContext(
      pool,
      'app.current_tenant_id',
      tenantResult.tenantId,
      (client) =>
        client.query(
          `SELECT is_active, termination_reason
           FROM user_sessions
           WHERE tenant_id = $1 AND user_id = (SELECT id FROM users WHERE tenant_id = $1 AND email = $2)
           ORDER BY login_at DESC
           LIMIT 1`,
          [tenantResult.tenantId, newUserEmail],
        ),
    );
    expect(revokedConcurrentSession.rows[0]).toMatchObject({
      is_active: false,
      termination_reason: 'refresh_token_reuse',
    });

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
      headers: { authorization: 'Bearer valid-session-t1' },
    });
    expect(badToken.statusCode).toBe(401);

    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: newUserUsername, password: 'WrongPassword!' },
    });
    expect(wrongPassword.statusCode).toBe(401);
    const failureAudit = await withTenantContext(pool, 'app.current_tenant_id', tenantResult.tenantId, (client) =>
      client.query(
        `SELECT action, outcome, metadata
         FROM audit_events
         WHERE tenant_id = $1 AND action = 'auth.login.failure'
         ORDER BY created_at DESC
         LIMIT 1`,
        [tenantResult.tenantId],
      ),
    );
    expect(failureAudit.rows[0]).toMatchObject({ action: 'auth.login.failure', outcome: 'failure' });
    expect(JSON.stringify(failureAudit.rows[0].metadata)).not.toMatch(/WrongPassword|password|token|secret/i);

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
    const inactiveUsername = `inactiveuser${uniqueSuffix}`;
    const inactiveEmail = `${inactiveUsername}@example.com`;
    const testUser = await repository.createUser({
      id: testUserId,
      tenantId: tenantResult.tenantId,
      organizationId: tenantResult.organizationId,
      defaultBranchId: tenantResult.branchId,
      username: inactiveUsername,
      email: inactiveEmail,
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
    const deletedUsername = `deleteduser${uniqueSuffix}`;
    const deletedEmail = `${deletedUsername}@example.com`;
    const testUser = await repository.createUser({
      id: testUserId,
      tenantId: tenantResult.tenantId,
      organizationId: tenantResult.organizationId,
      defaultBranchId: tenantResult.branchId,
      username: deletedUsername,
      email: deletedEmail,
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

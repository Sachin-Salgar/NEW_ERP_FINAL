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

describe('Authorization RBAC vertical slice', () => {
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

  runIfDatabase('enforces tenant-scoped role-based access control and module enablement', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    await platformBootstrapService.seedReferenceData();

    const uniqueSuffix = `${Date.now()}-${uuidV7()}`;
    const tenantAInput = {
      tenant: {
        name: `Authorization Tenant A ${uniqueSuffix}`,
        displayName: `Authorization Tenant A ${uniqueSuffix}`,
        subdomain: `auth-rbac-a-${uniqueSuffix}`,
        slug: `auth-rbac-a-${uniqueSuffix}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: {
        code: `RBACA${uniqueSuffix}`.slice(0, 18),
        name: `RBAC Org A ${uniqueSuffix}`,
        fiscalCalendar: 'standard',
      },
      branch: {
        code: `RBACA${uniqueSuffix}`.slice(0, 15),
        name: `RBAC Branch A ${uniqueSuffix}`,
        city: 'Bengaluru',
        country: 'IN',
      },
      administrator: {
        username: `admina${uniqueSuffix}`,
        email: `admina${uniqueSuffix}@example.com`,
        password: 'Password123!',
      },
      role: {
        code: `admina${uniqueSuffix}`.slice(0, 20),
        name: `Admin A ${uniqueSuffix}`,
      },
      permissions: ['role.manage', 'role.read', 'user.manage', 'user.read', 'permission.read', 'branch.read'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: {
        name: `FY-A-${uniqueSuffix}`,
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
    };

    const tenantBInput = {
      tenant: {
        name: `Authorization Tenant B ${uniqueSuffix}`,
        displayName: `Authorization Tenant B ${uniqueSuffix}`,
        subdomain: `auth-rbac-b-${uniqueSuffix}`,
        slug: `auth-rbac-b-${uniqueSuffix}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: {
        code: `RBACB${uniqueSuffix}`.slice(0, 18),
        name: `RBAC Org B ${uniqueSuffix}`,
        fiscalCalendar: 'standard',
      },
      branch: {
        code: `RBACB${uniqueSuffix}`.slice(0, 15),
        name: `RBAC Branch B ${uniqueSuffix}`,
        city: 'Pune',
        country: 'IN',
      },
      administrator: {
        username: `adminb${uniqueSuffix}`,
        email: `adminb${uniqueSuffix}@example.com`,
        password: 'Password123!',
      },
      role: {
        code: `adminb${uniqueSuffix}`.slice(0, 20),
        name: `Admin B ${uniqueSuffix}`,
      },
      permissions: ['role.manage', 'role.read', 'user.manage', 'user.read', 'permission.read', 'branch.read'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: {
        name: `FY-B-${uniqueSuffix}`,
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
    };

    const tenantAResult = await tenantBootstrapService.bootstrapTenant(tenantAInput);
    const tenantBResult = await tenantBootstrapService.bootstrapTenant(tenantBInput);

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

    const tenantAHost = tenantAInput.tenant.subdomain;
    const tenantBHost = tenantBInput.tenant.subdomain;

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantAHost,
        'x-tenant-id': tenantAResult.tenantId,
      },
      payload: { identifier: tenantAInput.administrator.username, password: tenantAInput.administrator.password },
    });
    expect(adminLogin.statusCode).toBe(200);
    const adminAJson = adminLogin.json();
    const adminAToken = adminAJson.accessToken;

    const permissionsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/rbac/permissions',
      headers: { authorization: `Bearer ${adminAToken}`, 'x-tenant-id': tenantAResult.tenantId },
    });
    expect(permissionsResponse.statusCode).toBe(200);
    expect(permissionsResponse.json().permissions.some((permission: { permissionKey: string }) => permission.permissionKey === 'branch.read')).toBe(true);

    const roleCreateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/rbac/roles',
      headers: { authorization: `Bearer ${adminAToken}`, 'x-tenant-id': tenantAResult.tenantId },
      payload: {
        code: 'analyst',
        name: 'Analyst',
        description: 'Tenant-scoped analyst role',
      },
    });
    expect(roleCreateResponse.statusCode).toBe(200);
    const role = roleCreateResponse.json().role;
    expect(role.code).toBe('analyst');

    const permissionAssignment = await app.inject({
      method: 'POST',
      url: `/api/v1/rbac/roles/${role.id}/permissions`,
      headers: { authorization: `Bearer ${adminAToken}`, 'x-tenant-id': tenantAResult.tenantId },
      payload: { permissionKeys: ['branch.read'] },
    });
    expect(permissionAssignment.statusCode).toBe(200);

    const regularUserResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { authorization: `Bearer ${adminAToken}`, 'x-tenant-id': tenantAResult.tenantId },
      payload: {
        username: `rbacuser${uniqueSuffix}`,
        email: `rbacuser${uniqueSuffix}@example.com`,
        password: 'Password456!',
        roleCode: 'member',
      },
    });
    expect(regularUserResponse.statusCode).toBe(201);
    const regularUser = regularUserResponse.json().user;

    const userRoleAssignment = await app.inject({
      method: 'POST',
      url: `/api/v1/rbac/users/${regularUser.id}/roles`,
      headers: { authorization: `Bearer ${adminAToken}`, 'x-tenant-id': tenantAResult.tenantId },
      payload: { roleId: role.id },
    });
    expect(userRoleAssignment.statusCode).toBe(200);
    expect(userRoleAssignment.json().assigned).toBe(true);

    const regularUserLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantAHost,
        'x-tenant-id': tenantAResult.tenantId,
      },
      payload: { identifier: regularUser.username, password: 'Password456!' },
    });
    expect(regularUserLogin.statusCode).toBe(200);
    const regularUserToken = regularUserLogin.json().accessToken;

    const effectivePermissions = await app.inject({
      method: 'GET',
      url: `/api/v1/rbac/users/${regularUser.id}/effective-permissions`,
      headers: { authorization: `Bearer ${regularUserToken}`, 'x-tenant-id': tenantAResult.tenantId },
    });
    expect(effectivePermissions.statusCode).toBe(200);
    expect(effectivePermissions.json().permissions.some((permission: { permissionKey: string }) => permission.permissionKey === 'branch.read')).toBe(true);

    const protectedRoute = await app.inject({
      method: 'GET',
      url: '/api/v1/rbac/test/branch-read-check',
      headers: { authorization: `Bearer ${regularUserToken}`, 'x-tenant-id': tenantAResult.tenantId },
    });
    expect(protectedRoute.statusCode).toBe(200);
    expect(protectedRoute.json().message).toBe('branch.read granted');

    const branchModule = await pool.query('SELECT id FROM modules WHERE code = $1 LIMIT 1', ['branch']);
    expect(branchModule.rows.length).toBe(1);
    const branchModuleId = branchModule.rows[0].id as string;

    await pool.query(
      `UPDATE tenant_modules
       SET enabled = false, disabled_at = NOW()
       WHERE tenant_id = $1 AND module_id = $2`,
      [tenantAResult.tenantId, branchModuleId],
    );

    const deniedByModule = await app.inject({
      method: 'GET',
      url: '/api/v1/rbac/test/branch-read-check',
      headers: { authorization: `Bearer ${regularUserToken}`, 'x-tenant-id': tenantAResult.tenantId },
    });
    expect(deniedByModule.statusCode).toBe(403);

    const permissionsAfterModuleDisable = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/effective-permissions`,
      headers: { authorization: `Bearer ${regularUserToken}`, 'x-tenant-id': tenantAResult.tenantId },
    });
    expect(permissionsAfterModuleDisable.statusCode).toBe(200);
    expect(permissionsAfterModuleDisable.json().permissions).not.toContain('branch.read');

    await pool.query(
      `UPDATE tenant_modules
       SET enabled = true, disabled_at = NULL
       WHERE tenant_id = $1 AND module_id = $2`,
      [tenantAResult.tenantId, branchModuleId],
    );

    const protectedRouteAfterModuleRestore = await app.inject({
      method: 'GET',
      url: '/api/v1/rbac/test/branch-read-check',
      headers: { authorization: `Bearer ${regularUserToken}`, 'x-tenant-id': tenantAResult.tenantId },
    });
    expect(protectedRouteAfterModuleRestore.statusCode).toBe(200);

    const revokePermission = await app.inject({
      method: 'DELETE',
      url: `/api/v1/rbac/roles/${role.id}/permissions`,
      headers: { authorization: `Bearer ${adminAToken}`, 'x-tenant-id': tenantAResult.tenantId },
      payload: { permissionKeys: ['branch.read'] },
    });
    expect(revokePermission.statusCode).toBe(200);
    expect(revokePermission.json().removed).toBeGreaterThan(0);

    const deniedAfterRevocation = await app.inject({
      method: 'GET',
      url: '/api/v1/rbac/test/branch-read-check',
      headers: { authorization: `Bearer ${regularUserToken}`, 'x-tenant-id': tenantAResult.tenantId },
    });
    expect(deniedAfterRevocation.statusCode).toBe(403);

    const secondAdminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantBHost,
        'x-tenant-id': tenantBResult.tenantId,
      },
      payload: { identifier: tenantBInput.administrator.username, password: tenantBInput.administrator.password },
    });
    expect(secondAdminLogin.statusCode).toBe(200);
    const secondAdminToken = secondAdminLogin.json().accessToken;

    const crossTenantRoleList = await app.inject({
      method: 'GET',
      url: '/api/v1/rbac/roles',
      headers: { authorization: `Bearer ${secondAdminToken}`, 'x-tenant-id': tenantAResult.tenantId },
    });
    expect(crossTenantRoleList.statusCode).toBe(401);

    const crossTenantUserPermissions = await app.inject({
      method: 'GET',
      url: `/api/v1/rbac/users/${regularUser.id}/effective-permissions`,
      headers: { authorization: `Bearer ${secondAdminToken}`, 'x-tenant-id': tenantAResult.tenantId },
    });
    expect(crossTenantUserPermissions.statusCode).toBe(401);

    await repository.updateUserStatus(tenantAResult.tenantId, regularUser.id, 'inactive');
    const stalePermissionKeys = await repository.getPermissionKeysForUser(tenantAResult.tenantId, regularUser.id);
    expect(stalePermissionKeys).toEqual([]);

    const staleLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantAHost,
        'x-tenant-id': tenantAResult.tenantId,
      },
      payload: { identifier: regularUser.username, password: 'Password456!' },
    });
    expect(staleLogin.statusCode).toBe(401);
  });
});
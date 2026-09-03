import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { parseAppConfig, resolveDatabaseUrl } from '../../src/config/schema.js';
import { CoreEnterpriseService } from '../../src/application/services/core-enterprise-service.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';
import { createApplication } from '../../src/presentation/http/app.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = it;

describe('CORE-01 organization and branch administration', () => {
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

  runIfDatabase('supports tenant-scoped organization branch user administration with RBAC enforcement', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    await platformBootstrapService.seedReferenceData();

    const uniqueSuffix = `${Date.now()}-${uuidV7()}`;
    const tenantInput = {
      tenant: {
        name: `Core Tenant ${uniqueSuffix}`,
        displayName: `Core Tenant ${uniqueSuffix}`,
        subdomain: `core-${uniqueSuffix}`,
        slug: `core-${uniqueSuffix}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: {
        code: `CORE${uniqueSuffix}`.slice(0, 18),
        name: `Core Org ${uniqueSuffix}`,
        fiscalCalendar: 'standard',
      },
      branch: {
        code: `BR-${uniqueSuffix}`.slice(0, 15),
        name: `Core Branch ${uniqueSuffix}`,
        city: 'Bengaluru',
        country: 'IN',
      },
      administrator: {
        username: `coreadmin${uniqueSuffix}`,
        email: `coreadmin${uniqueSuffix}@example.com`,
        password: 'Password123!',
      },
      role: {
        code: `coreadmin${uniqueSuffix}`.slice(0, 20),
        name: `Core Admin ${uniqueSuffix}`,
      },
      permissions: ['organization.read', 'organization.manage', 'branch.read', 'branch.manage', 'user.read', 'user.manage', 'role.manage', 'role.read', 'permission.read'],
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
    const adminAccessToken = adminLogin.json().accessToken as string;
    const adminHeaders = { authorization: `Bearer ${adminAccessToken}`, 'x-tenant-id': tenantResult.tenantId };

    const createOrgResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: adminHeaders,
      payload: {
        code: `ORG2${uniqueSuffix}`.slice(0, 18),
        name: `Portable Org ${uniqueSuffix}`,
        legalName: 'Portable Org Private Limited',
        email: 'ops@example.com',
      },
    });
    expect(createOrgResponse.statusCode).toBe(201);
    const createdOrg = createOrgResponse.json().organization;
    expect(createdOrg.tenantId).toBe(tenantResult.tenantId);
    expect(createdOrg.isDefault).toBe(false);

    const listOrganizationsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/organizations',
      headers: adminHeaders,
    });
    expect(listOrganizationsResponse.statusCode).toBe(200);
    const organizations = listOrganizationsResponse.json().organizations;
    expect(organizations.length).toBeGreaterThanOrEqual(2);
    expect(organizations.filter((organization: any) => organization.isDefault).length).toBe(1);
    expect(organizations.find((organization: any) => organization.id === tenantResult.organizationId)?.isDefault).toBe(true);
    expect(organizations.find((organization: any) => organization.id === createdOrg.id)?.isDefault).toBe(false);

    const getOrganizationResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrg.id}`,
      headers: adminHeaders,
    });
    expect(getOrganizationResponse.statusCode).toBe(200);
    expect(getOrganizationResponse.json().organization.id).toBe(createdOrg.id);

    const orgPatchResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${createdOrg.id}`,
      headers: adminHeaders,
      payload: { name: `Updated Org ${uniqueSuffix}` },
    });
    expect(orgPatchResponse.statusCode).toBe(200);
    expect(orgPatchResponse.json().organization.name).toBe(`Updated Org ${uniqueSuffix}`);

    const createBranchResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${createdOrg.id}/branches`,
      headers: adminHeaders,
      payload: {
        code: `BR2${uniqueSuffix}`.slice(0, 15),
        name: `Warehouse ${uniqueSuffix}`,
        city: 'Pune',
        country: 'IN',
      },
    });
    expect(createBranchResponse.statusCode).toBe(201);
    const createdBranch = createBranchResponse.json().branch;
    expect(createdBranch.organizationId).toBe(createdOrg.id);

    const branchListResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrg.id}/branches`,
      headers: adminHeaders,
    });
    expect(branchListResponse.statusCode).toBe(200);
    expect(branchListResponse.json().branches.some((branch: any) => branch.id === createdBranch.id)).toBe(true);

    const registerMemberResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: adminHeaders,
      payload: {
        username: `member${uniqueSuffix}`,
        email: `member${uniqueSuffix}@example.com`,
        password: 'Password456!',
        organizationId: createdOrg.id,
        defaultBranchId: createdBranch.id,
        roleCode: 'member',
      },
    });
    expect(registerMemberResponse.statusCode).toBe(201);
    const memberUser = registerMemberResponse.json().user;

    const userListResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: adminHeaders,
    });
    expect(userListResponse.statusCode).toBe(200);
    expect(userListResponse.json().users.some((user: any) => user.id === memberUser.id)).toBe(true);

    const userAssignOrgResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${memberUser.id}/organizations/${createdOrg.id}/access`,
      headers: adminHeaders,
    });
    expect(userAssignOrgResponse.statusCode).toBe(200);

    const userAssignBranchResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${memberUser.id}/branches/${createdBranch.id}/access`,
      headers: adminHeaders,
    });
    expect(userAssignBranchResponse.statusCode).toBe(200);

    const userAccessResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${memberUser.id}/access`,
      headers: adminHeaders,
    });
    expect(userAccessResponse.statusCode).toBe(200);
    expect(userAccessResponse.json()).toMatchObject({
      success: true,
      userId: memberUser.id,
    });
    expect(userAccessResponse.json().organizations).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: createdOrg.id, name: expect.any(String) })]),
    );
    expect(userAccessResponse.json().branches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdBranch.id,
          organizationId: createdOrg.id,
          organizationName: expect.any(String),
        }),
      ]),
    );

    const limitedUserRegister = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: adminHeaders,
      payload: {
        username: `limited${uniqueSuffix}`,
        email: `limited${uniqueSuffix}@example.com`,
        password: 'Password789!',
        organizationId: createdOrg.id,
        defaultBranchId: createdBranch.id,
        roleCode: 'member',
      },
    });
    expect(limitedUserRegister.statusCode).toBe(201);
    const limitedUser = limitedUserRegister.json().user;
    const limitedUserRow = await withTenantContext(
      pool,
      'app.current_tenant_id',
      tenantResult.tenantId,
      (client) =>
        client.query(
          'SELECT id FROM users WHERE tenant_id = $1 AND username = $2',
          [tenantResult.tenantId, `limited${uniqueSuffix}`],
        ),
    );
    limitedUser.id = limitedUserRow.rows[0].id;

    const limitedLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: `limited${uniqueSuffix}`, password: 'Password789!' },
    });
    expect(limitedLogin.statusCode).toBe(200);
    const limitedToken = limitedLogin.json().accessToken as string;

    await withTenantContext(
      pool,
      'app.current_tenant_id',
      tenantResult.tenantId,
      (client) =>
        client
          .query(
            'DELETE FROM user_organization_access WHERE tenant_id = $1 AND user_id = $2',
            [tenantResult.tenantId, limitedUser.id],
          )
          .then(() =>
            client.query(
              'DELETE FROM user_branch_access WHERE tenant_id = $1 AND user_id = $2',
              [tenantResult.tenantId, limitedUser.id],
            ),
          )
          .then(() =>
            client.query(
              'UPDATE users SET organization_id = $1, default_branch_id = $2 WHERE id = $3 AND tenant_id = $4',
              [createdOrg.id, createdBranch.id, limitedUser.id, tenantResult.tenantId],
            ),
          ),
    );

    const emptyUserAccessResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${limitedUser.id}/access`,
      headers: adminHeaders,
    });
    expect(emptyUserAccessResponse.statusCode).toBe(200);
    expect(emptyUserAccessResponse.json().organizations).toEqual([]);
    expect(emptyUserAccessResponse.json().branches).toEqual([]);

    const forbiddenOrganizationList = await app.inject({
      method: 'GET',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${limitedToken}`, 'x-tenant-id': tenantResult.tenantId },
    });
    expect(forbiddenOrganizationList.statusCode).toBe(403);

    const forbiddenUserAccess = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${memberUser.id}/access`,
      headers: {
        authorization: ['Bearer', limitedToken].join(' '),
        'x-tenant-id': tenantResult.tenantId,
      },
    });
    expect(forbiddenUserAccess.statusCode).toBe(403);

    const deactivateUserResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${memberUser.id}/deactivate`,
      headers: adminHeaders,
    });
    expect(deactivateUserResponse.statusCode).toBe(200);

    const deactivatedUserAccess = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${memberUser.id}/access`,
      headers: adminHeaders,
    });
    expect(deactivatedUserAccess.statusCode).toBe(200);

    const memberLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: tenantHost,
        'x-tenant-id': tenantResult.tenantId,
      },
      payload: { identifier: `member${uniqueSuffix}`, password: 'Password456!' },
    });
    expect(memberLogin.statusCode).toBe(401);

    const secondTenantSuffix = `${Date.now()}-${uuidV7()}`;
    const secondTenantInput = {
      tenant: {
        name: `Other Tenant ${secondTenantSuffix}`,
        displayName: `Other Tenant ${secondTenantSuffix}`,
        subdomain: `other-${secondTenantSuffix}`,
        slug: `other-${secondTenantSuffix}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: {
        code: `OTHER${secondTenantSuffix}`.slice(0, 18),
        name: `Other Org ${secondTenantSuffix}`,
        fiscalCalendar: 'standard',
      },
      branch: {
        code: `OBR${secondTenantSuffix}`.slice(0, 15),
        name: `Other Branch ${secondTenantSuffix}`,
        city: 'Delhi',
        country: 'IN',
      },
      administrator: {
        username: `otheradmin${secondTenantSuffix}`,
        email: `otheradmin${secondTenantSuffix}@example.com`,
        password: 'Password123!',
      },
      role: {
        code: `otheradmin${secondTenantSuffix}`.slice(0, 20),
        name: `Other Admin ${secondTenantSuffix}`,
      },
      permissions: ['organization.read', 'organization.manage', 'branch.read', 'branch.manage', 'user.read', 'user.manage'],
      subscriptionPlanName: 'Starter',
    };

    const otherTenantResult = await tenantBootstrapService.bootstrapTenant(secondTenantInput);
    const otherLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        host: secondTenantInput.tenant.subdomain,
        'x-tenant-id': otherTenantResult.tenantId,
      },
      payload: { identifier: secondTenantInput.administrator.username, password: secondTenantInput.administrator.password },
    });
    const otherToken = otherLogin.json().accessToken as string;

    const crossTenantOrganization = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${otherTenantResult.organizationId}`,
      headers: { authorization: `Bearer ${adminAccessToken}`, 'x-tenant-id': tenantResult.tenantId },
    });
    expect(crossTenantOrganization.statusCode).toBe(404);

    const crossTenantBranch = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${otherTenantResult.organizationId}/branches/${otherTenantResult.branchId}`,
      headers: { authorization: `Bearer ${adminAccessToken}`, 'x-tenant-id': tenantResult.tenantId },
    });
    expect(crossTenantBranch.statusCode).toBe(404);

    const crossTenantUser = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${otherTenantResult.userId}`,
      headers: { authorization: `Bearer ${adminAccessToken}`, 'x-tenant-id': tenantResult.tenantId },
    });
    expect(crossTenantUser.statusCode).toBe(404);

    const crossTenantUserAccess = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${otherTenantResult.userId}/access`,
      headers: adminHeaders,
    });
    expect(crossTenantUserAccess.statusCode).toBe(404);

    const invalidUserAccess = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${uuidV7()}/access`,
      headers: adminHeaders,
    });
    expect(invalidUserAccess.statusCode).toBe(404);

    const deactivatedOrg = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${createdOrg.id}/deactivate`,
      headers: adminHeaders,
    });
    expect(deactivatedOrg.statusCode).toBe(200);

    const inactiveOrgLookup = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrg.id}`,
      headers: adminHeaders,
    });
    expect(inactiveOrgLookup.statusCode).toBe(404);

    const branchDeactivate = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${createdOrg.id}/branches/${createdBranch.id}/deactivate`,
      headers: adminHeaders,
    });
    expect(branchDeactivate.statusCode).toBe(200);

    const inactiveBranchLookup = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrg.id}/branches/${createdBranch.id}`,
      headers: adminHeaders,
    });
    expect(inactiveBranchLookup.statusCode).toBe(404);

    const unauthenticated = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
    });
    expect(unauthenticated.statusCode).toBe(401);

    const forbiddenResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: {
        authorization: `Bearer ${limitedToken}`,
        'x-tenant-id': tenantResult.tenantId,
      },
    });
    expect(forbiddenResponse.statusCode).toBe(403);
  });

  runIfDatabase('generates unique organization and branch codes under concurrent creation', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const repository = new PostgresPlatformRepository(pool);
    const coreEnterpriseService = new CoreEnterpriseService(repository);
    const passwordHasher = new BcryptPasswordHasher();
    const bootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

    await bootstrapService.seedReferenceData();

    const uniqueSuffix = `${Date.now()}-${uuidV7()}`;
    const tenantResult = await tenantBootstrapService.bootstrapTenant({
      tenant: {
        name: `Concurrent Tenant ${uniqueSuffix}`,
        displayName: `Concurrent Tenant ${uniqueSuffix}`,
        subdomain: `concurrent-${uniqueSuffix}`,
        slug: `concurrent-${uniqueSuffix}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: {
        name: `Concurrent Org ${uniqueSuffix}`,
        fiscalCalendar: 'standard',
      },
      branch: {
        name: `Concurrent Branch ${uniqueSuffix}`,
        city: 'Bengaluru',
        country: 'IN',
      },
      administrator: {
        username: `concurrentadmin${uniqueSuffix}`,
        email: `concurrentadmin${uniqueSuffix}@example.com`,
        password: 'Password123!',
      },
      role: {
        code: `concurrentadmin${uniqueSuffix}`.slice(0, 20),
        name: `Concurrent Admin ${uniqueSuffix}`,
      },
      permissions: ['organization.read', 'organization.manage', 'branch.read', 'branch.manage', 'user.read', 'user.manage'],
      subscriptionPlanName: 'Starter',
    });

    const maliciousOrganization = await coreEnterpriseService.createOrganization(tenantResult.tenantId, {
      code: 'ATTACK001',
      name: `Malicious Org ${uniqueSuffix}`,
    });
    expect(maliciousOrganization.code).not.toBe('ATTACK001');
    expect(maliciousOrganization.code).toMatch(/^ORG\d{6}$/);

    const organizationResults = await Promise.all(
      Array.from({ length: 12 }, (_, index) => coreEnterpriseService.createOrganization(tenantResult.tenantId, {
        name: `Concurrent Org ${index}-${uniqueSuffix}`,
      })),
    );
    const organizationCodes = organizationResults.map((organization) => organization.code);
    expect(new Set(organizationCodes).size).toBe(organizationCodes.length);
    expect(organizationCodes.every((code) => /^ORG\d{6}$/.test(code))).toBe(true);

    const maliciousBranch = await coreEnterpriseService.createBranch(tenantResult.tenantId, tenantResult.organizationId, {
      code: 'ATTACK001',
      name: `Malicious Branch ${uniqueSuffix}`,
    });
    expect(maliciousBranch.code).not.toBe('ATTACK001');
    expect(maliciousBranch.code).toMatch(/^BR\d{3}$/);

    const branchResults = await Promise.all(
      Array.from({ length: 12 }, (_, index) => coreEnterpriseService.createBranch(tenantResult.tenantId, tenantResult.organizationId, {
        name: `Concurrent Branch ${index}-${uniqueSuffix}`,
      })),
    );
    const branchCodes = branchResults.map((branch) => branch.code);
    expect(new Set(branchCodes).size).toBe(branchCodes.length);
    expect(branchCodes.every((code) => /^BR\d{3}$/.test(code))).toBe(true);
  });
});

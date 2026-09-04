import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { parseAppConfig, resolveDatabaseUrl } from '../../src/config/schema.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { createApplication } from '../../src/presentation/http/app.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = databaseUrl ? it : it.skip;

describe('Customer HTTP API', () => {
  let pool: Pool | undefined;
  let app: Awaited<ReturnType<typeof createApplication>> | undefined;

  afterAll(async () => {
    if (app) await app.close();
    if (pool) await pool.end();
  });

  runIfDatabase('enforces the Customer API contract and tenant security boundaries', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    await new PlatformBootstrapService(repository).seedReferenceData();

    const suffix = `${Date.now()}-${uuidV7()}`;
    const input = {
      tenant: {
        name: `Customer API Tenant ${suffix}`,
        subdomain: `customer-api-${suffix}`,
        slug: `customer-api-${suffix}`,
      },
      organization: { code: `CUS${suffix}`.slice(0, 18), name: 'Customer API Organization' },
      branch: { code: `BR${suffix}`.slice(0, 15), name: 'Head Office' },
      administrator: {
        username: `customer-admin-${suffix}`,
        email: `customer-admin-${suffix}@example.com`,
        password: 'Password123!',
      },
      role: { code: `customer-admin-${suffix}`.slice(0, 20), name: 'Customer Administrator' },
      permissions: ['customer.read', 'customer.create', 'customer.update', 'customer.delete'],
      subscriptionPlanName: 'Starter',
    };
    const bootstrap = await new TenantBootstrapService(repository, passwordHasher).bootstrapTenant(input);

    await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, async (client) => {
      const moduleResult = await client.query(`SELECT id FROM modules WHERE code = 'crm'`);
      const moduleId = moduleResult.rows[0]?.id;
      if (!moduleId) throw new Error('CRM module seed is missing.');
      await client.query(
        `INSERT INTO tenant_modules (id, tenant_id, module_id, enabled, enabled_at, enabled_reason)
         VALUES ($1, $2, $3, true, NOW(), 'customer api test')
         ON CONFLICT (tenant_id, module_id) DO UPDATE SET enabled = true, disabled_at = NULL`,
        [uuidV7(), bootstrap.tenantId, moduleId],
      );
      await client.query(
        `INSERT INTO organization_modules (id, tenant_id, organization_id, module_id, enabled, enabled_at)
         VALUES ($1, $2, $3, $4, true, NOW())
         ON CONFLICT (organization_id, module_id) DO UPDATE SET enabled = true, disabled_at = NULL`,
        [uuidV7(), bootstrap.tenantId, bootstrap.organizationId, moduleId],
      );
    });

    const config = parseAppConfig({
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl!,
      DATABASE_SSL_MODE: 'disable',
      JWT_SECRET: 'test-only-jwt-secret-change-me-123456789',
      MFA_ENCRYPTION_KEY: 'test-only-mfa-encryption-key-change-me-123456',
    });
    app = await createApplication(config, pool);

    for (const request of [
      { method: 'POST' as const, url: '/api/v1/customers', payload: { organizationId: bootstrap.organizationId, name: 'No Auth' } },
      { method: 'GET' as const, url: '/api/v1/customers' },
      { method: 'GET' as const, url: `/api/v1/customers/${uuidV7()}` },
      { method: 'PATCH' as const, url: `/api/v1/customers/${uuidV7()}`, payload: { name: 'No Auth' } },
      { method: 'DELETE' as const, url: `/api/v1/customers/${uuidV7()}` },
    ]) {
      const unauthenticated = await app.inject(request);
      expect(unauthenticated.statusCode).toBe(401);
    }

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-id': bootstrap.tenantId },
      payload: { identifier: input.administrator.username, password: input.administrator.password },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().accessToken as string;
    const authHeaders = { authorization: `Bearer ${token}`, 'x-tenant-id': uuidV7() };

    const invalidCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/customers',
      headers: authHeaders,
      payload: { organizationId: bootstrap.organizationId, name: '   ' },
    });
    expect(invalidCreate.statusCode).toBe(400);

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/customers',
      headers: authHeaders,
      payload: { organizationId: bootstrap.organizationId, name: '  Acme API Customer  ' },
    });
    expect(created.statusCode).toBe(201);
    const customer = created.json().customer;
    expect(customer.name).toBe('Acme API Customer');
    expect(customer.tenantId).toBeUndefined();

    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/customers?page=1&page_size=20&search=acme',
      headers: authHeaders,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().customers).toHaveLength(1);
    expect(listed.json().metadata).toMatchObject({ page: 1, page_size: 20, total: 1 });

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/customers/${customer.id}`,
      headers: authHeaders,
      payload: { name: 'Updated API Customer' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().customer.name).toBe('Updated API Customer');

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/customers/${customer.id}`,
      headers: authHeaders,
    });
    expect(deleted.statusCode).toBe(200);

    const afterDelete = await app.inject({
      method: 'GET',
      url: `/api/v1/customers/${customer.id}`,
      headers: authHeaders,
    });
    expect(afterDelete.statusCode).toBe(404);
    const crossTenantRead = await app.inject({
      method: 'GET',
      url: `/api/v1/customers/${uuidV7()}`,
      headers: authHeaders,
    });
    expect(crossTenantRead.statusCode).toBe(404);

    const auditEvents = await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, (client) =>
      client.query(
        `SELECT action, resource_id
           FROM audit_events
          WHERE tenant_id = $1 AND resource_type = 'customer' AND resource_id = $2
          ORDER BY created_at`,
        [bootstrap.tenantId, customer.id],
      ),
    );
    expect(auditEvents.rows.map((row) => row.action)).toEqual([
      'customer.created',
      'customer.updated',
      'customer.deleted',
    ]);

    const organizationB = await repository.createOrganization(bootstrap.tenantId, {
      name: 'Customer API Organization B',
    });
    await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, async (client) => {
      const moduleResult = await client.query(`SELECT id FROM modules WHERE code = 'crm'`);
      const moduleId = moduleResult.rows[0]?.id;
      if (!moduleId) throw new Error('CRM module seed is missing.');
      await client.query(
        `INSERT INTO organization_modules (id, tenant_id, organization_id, module_id, enabled, enabled_at)
         VALUES ($1, $2, $3, $4, true, NOW())`,
        [uuidV7(), bootstrap.tenantId, organizationB.id, moduleId],
      );
    });
    const organizationBUser = await repository.createUser({
      tenantId: bootstrap.tenantId,
      organizationId: organizationB.id,
      username: `customer-org-b-${suffix}`,
      email: `customer-org-b-${suffix}@example.com`,
      passwordHash: await passwordHasher.hash('Password123!'),
    });
    await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, async (client) => {
      await client.query(
        `INSERT INTO user_permissions (tenant_id, user_id, permission_id, allow)
         SELECT $1, $2, id, true
           FROM permissions
          WHERE permission_key IN ('customer.read', 'customer.create', 'customer.update', 'customer.delete')`,
        [bootstrap.tenantId, organizationBUser.id],
      );
    });
    const organizationBLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-id': bootstrap.tenantId },
      payload: { identifier: organizationBUser.username, password: 'Password123!' },
    });
    expect(organizationBLogin.statusCode).toBe(200);
    const organizationBHeaders = { authorization: `Bearer ${organizationBLogin.json().accessToken}` };

    const organizationACustomer = await app.inject({
      method: 'POST',
      url: '/api/v1/customers',
      headers: authHeaders,
      payload: { organizationId: bootstrap.organizationId, name: 'Organization A Isolation Customer' },
    });
    expect(organizationACustomer.statusCode).toBe(201);
    const isolatedCustomer = organizationACustomer.json().customer;
    const isolatedVersion = isolatedCustomer.version;

    const crossOrganizationGet = await app.inject({
      method: 'GET',
      url: `/api/v1/customers/${isolatedCustomer.id}`,
      headers: organizationBHeaders,
    });
    expect(crossOrganizationGet.statusCode).toBe(404);

    const crossOrganizationPatch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/customers/${isolatedCustomer.id}`,
      headers: organizationBHeaders,
      payload: { name: 'Cross Organization Mutation' },
    });
    expect(crossOrganizationPatch.statusCode).toBe(404);

    const crossOrganizationDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/customers/${isolatedCustomer.id}`,
      headers: organizationBHeaders,
    });
    expect(crossOrganizationDelete.statusCode).toBe(404);

    const organizationBList = await app.inject({
      method: 'GET',
      url: '/api/v1/customers?page=1&page_size=20',
      headers: organizationBHeaders,
    });
    expect(organizationBList.statusCode).toBe(200);
    expect(organizationBList.json().customers).toEqual([]);
    expect(organizationBList.json().metadata).toMatchObject({ page: 1, page_size: 20, total: 0, total_pages: 0 });

    const organizationAAfterRejectedOperations = await app.inject({
      method: 'GET',
      url: `/api/v1/customers/${isolatedCustomer.id}`,
      headers: authHeaders,
    });
    expect(organizationAAfterRejectedOperations.statusCode).toBe(200);
    expect(organizationAAfterRejectedOperations.json().customer).toMatchObject({
      id: isolatedCustomer.id,
      name: 'Organization A Isolation Customer',
      version: isolatedVersion,
      isDeleted: false,
    });

    await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, async (client) => {
      await client.query(
        `DELETE FROM user_permissions
          WHERE tenant_id = $1
            AND user_id = $2
            AND permission_id IN (SELECT id FROM permissions WHERE permission_key LIKE 'customer.%')`,
        [bootstrap.tenantId, bootstrap.userId],
      );
      await client.query(
        `DELETE FROM role_permissions
          WHERE tenant_id = $1
            AND role_id = (SELECT role_id FROM user_roles WHERE tenant_id = $1 AND user_id = $2 LIMIT 1)
            AND permission_id IN (SELECT id FROM permissions WHERE permission_key LIKE 'customer.%')`,
        [bootstrap.tenantId, bootstrap.userId],
      );
    });
    const missingPermission = await app.inject({ method: 'GET', url: '/api/v1/customers', headers: authHeaders });
    expect(missingPermission.statusCode).toBe(403);

    const crossOrganization = await app.inject({
      method: 'POST',
      url: '/api/v1/customers',
      headers: authHeaders,
      payload: { organizationId: uuidV7(), name: 'Cross Organization Customer' },
    });
    expect(crossOrganization.statusCode).toBe(403);

    await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, (client) =>
      client.query(
        `UPDATE organization_modules
            SET enabled = false, disabled_at = NOW(), disabled_by = $1
          WHERE organization_id = $2
            AND module_id = (SELECT id FROM modules WHERE code = 'crm')`,
        [bootstrap.userId, bootstrap.organizationId],
      ),
    );
    const disabledModule = await app.inject({ method: 'GET', url: '/api/v1/customers', headers: authHeaders });
    expect(disabledModule.statusCode).toBe(403);
  });
});

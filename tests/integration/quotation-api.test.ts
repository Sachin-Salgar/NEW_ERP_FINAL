import { afterAll, describe, expect, it } from 'vitest';
import { v7 as uuidV7 } from 'uuid';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PostgresCustomerRepository } from '../../src/infrastructure/database/repositories/postgres-customer-repository.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';
import { createTestApp, createTestPool } from '../helpers/test-app.js';

const runIfDatabase = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL ? it : it.skip;

describe('Quotation HTTP API', () => {
  let pool: ReturnType<typeof createTestPool> | undefined;
  let app: Awaited<ReturnType<typeof createTestApp>> | undefined;

  afterAll(async () => {
    if (app) await app.close();
    if (pool) await pool.end();
  });

  runIfDatabase('requires authentication on quotation collection and lifecycle routes', async () => {
    pool = createTestPool();
    app = await createTestApp(pool);
    const requests = [
      { method: 'GET' as const, url: '/api/v1/sales/quotations' },
      { method: 'GET' as const, url: '/api/v1/sales/quotations/00000000-0000-0000-0000-000000000000' },
      ...(['send', 'accept', 'reject', 'expire', 'cancel'] as const).map((action) => ({
        method: 'POST' as const,
        url: `/api/v1/sales/quotations/00000000-0000-0000-0000-000000000000/${action}`,
      })),
    ];
    for (const request of requests) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(401);
    }
  });

  runIfDatabase('enforces module, permission, organization, lifecycle, and tenant boundaries', async () => {
    pool = createTestPool();
    const passwordHasher = new BcryptPasswordHasher();
    const suffix = `${Date.now()}-${uuidV7()}`;
    const input = {
      tenant: {
        name: `Quotation API Tenant ${suffix}`,
        subdomain: `quotation-api-${suffix}`,
        slug: `quotation-api-${suffix}`,
      },
      organization: { code: `Q${suffix}`.slice(0, 18), name: 'Quotation API Organization' },
      branch: { code: `QB${suffix}`.slice(0, 15), name: 'Head Office' },
      administrator: {
        username: `quotation-admin-${suffix}`,
        email: `quotation-admin-${suffix}@example.com`,
        password: 'Password123!',
      },
      role: { code: `quotation-admin-${suffix}`.slice(0, 20), name: 'Quotation Administrator' },
      permissions: [
        'sales.quotation.read',
        'sales.quotation.create',
        'sales.quotation.update',
        'sales.quotation.delete',
        'sales.quotation.send',
        'sales.quotation.accept',
        'sales.quotation.reject',
        'sales.quotation.expire',
        'sales.quotation.cancel',
      ],
      subscriptionPlanName: 'Starter',
    };
    const repository = new PostgresPlatformRepository(pool);
    await new PlatformBootstrapService(repository).seedReferenceData();
    const bootstrap = await new TenantBootstrapService(repository, passwordHasher).bootstrapTenant(input);
    await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, async (client) => {
      const module = await client.query(`SELECT id FROM modules WHERE code = 'sales'`);
      const moduleId = module.rows[0]?.id;
      if (!moduleId) throw new Error('Sales module seed is missing.');
      await client.query(
        `INSERT INTO tenant_modules (id, tenant_id, module_id, enabled, enabled_at)
         VALUES ($1, $2, $3, true, NOW())
         ON CONFLICT (tenant_id, module_id) DO UPDATE SET enabled = true, disabled_at = NULL`,
        [uuidV7(), bootstrap.tenantId, moduleId],
      );
      await client.query(
        `INSERT INTO organization_modules (id, tenant_id, organization_id, module_id, enabled, enabled_at)
         VALUES ($1, $2, $3, $4, true, NOW())
         ON CONFLICT (organization_id, module_id) DO UPDATE SET enabled = true, disabled_at = NULL`,
        [uuidV7(), bootstrap.tenantId, bootstrap.organizationId, moduleId],
      );
      await client.query(
        `INSERT INTO user_permissions (tenant_id, user_id, permission_id, allow)
         SELECT $1, $2, id, true
           FROM permissions
          WHERE module_code = 'sales'
         ON CONFLICT (tenant_id, user_id, permission_id) DO UPDATE SET allow = true`,
        [bootstrap.tenantId, bootstrap.userId],
      );
    });
    const customer = await new PostgresCustomerRepository(pool).create({
      tenantId: bootstrap.tenantId,
      organizationId: bootstrap.organizationId,
      name: 'Quotation API Customer',
      actorUserId: bootstrap.userId,
    });
    app = await createTestApp(pool);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-id': bootstrap.tenantId },
      payload: { identifier: input.administrator.username, password: input.administrator.password },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().accessToken as string;
    const headers = { authorization: `Bearer ${token}`, 'x-tenant-id': uuidV7() };
    const payload = {
      customerId: customer.id,
      quotationDate: '2026-09-01',
      validUntil: '2026-09-30',
      notes: 'API boundary test',
      items: [{ description: 'Implementation', quantity: 1, unitPrice: 250, unitOfMeasure: 'hour' }],
    };

    const created = await app.inject({ method: 'POST', url: '/api/v1/sales/quotations', headers, payload });
    expect(created.statusCode).toBe(201);
    const quotation = created.json().quotation;
    expect(quotation.tenantId).toBeUndefined();
    expect(quotation.status).toBe('DRAFT');

    const listed = await app.inject({ method: 'GET', url: '/api/v1/sales/quotations?search=DRAFT', headers });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().quotations).toHaveLength(1);
    const bodyTenantSpoof = await app.inject({
      method: 'POST',
      url: '/api/v1/sales/quotations',
      headers,
      payload: { ...payload, tenant_id: uuidV7() },
    });
    expect(bodyTenantSpoof.statusCode).toBe(400);
    const queryTenantSpoof = await app.inject({
      method: 'GET',
      url: `/api/v1/sales/quotations?tenant_id=${uuidV7()}`,
      headers,
    });
    expect(queryTenantSpoof.statusCode).toBe(200);
    expect(queryTenantSpoof.json().quotations.length).toBeGreaterThanOrEqual(1);
    const urlTenantSpoof = await app.inject({
      method: 'GET',
      url: `/api/v1/sales/quotations/${uuidV7()}`,
      headers,
    });
    expect(urlTenantSpoof.statusCode).toBe(404);

    const spoofedTenantRead = await app.inject({
      method: 'GET',
      url: `/api/v1/sales/quotations/${quotation.id}`,
      headers,
    });
    expect(spoofedTenantRead.statusCode).toBe(200);

    const deletedDraft = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sales/quotations/${quotation.id}`,
      headers,
    });
    expect(deletedDraft.statusCode).toBe(200);
    expect(deletedDraft.json().quotation.isDeleted).toBe(true);
    const deletedDraftDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/sales/quotations/${quotation.id}`,
      headers,
    });
    expect(deletedDraftDetail.statusCode).toBe(404);

    const secondCreated = await app.inject({ method: 'POST', url: '/api/v1/sales/quotations', headers, payload });
    expect(secondCreated.statusCode).toBe(201);
    const sentQuotation = secondCreated.json().quotation;
    const sent = await app.inject({
      method: 'POST',
      url: `/api/v1/sales/quotations/${sentQuotation.id}/send`,
      headers,
    });
    expect(sent.statusCode).toBe(200);
    const sentDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sales/quotations/${sentQuotation.id}`,
      headers,
    });
    expect(sentDelete.statusCode).toBe(400);
    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/v1/sales/quotations/${sentQuotation.id}/cancel`,
      headers,
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().quotation.status).toBe('CANCELLED');

    const auditEvents = await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, (client) =>
      client.query(
        `SELECT action FROM audit_events
          WHERE tenant_id = $1 AND resource_type = 'sales_quotation'
            AND resource_id IN ($2, $3)
          ORDER BY created_at`,
        [bootstrap.tenantId, quotation.id, sentQuotation.id],
      ),
    );
    expect(auditEvents.rows.map((row) => row.action)).toEqual(
      expect.arrayContaining(['quotation.deleted', 'quotation.cancelled']),
    );

    await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, (client) =>
      client.query(
        `UPDATE tenant_modules SET enabled = false, disabled_at = NOW()
         WHERE tenant_id = $1 AND module_id = (SELECT id FROM modules WHERE code = 'sales')`,
        [bootstrap.tenantId],
      ),
    );
    const disabled = await app.inject({ method: 'GET', url: '/api/v1/sales/quotations', headers });
    expect(disabled.statusCode).toBe(403);
  });
});

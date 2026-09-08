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
const salesPermissions = [
  'sales.quotation.read',
  'sales.quotation.create',
  'sales.quotation.update',
  'sales.quotation.delete',
  'sales.order.read',
  'sales.order.create',
  'sales.order.update',
  'sales.order.delete',
  'sales.delivery.read',
  'sales.delivery.create',
  'sales.delivery.update',
  'sales.invoice.read',
  'sales.invoice.create',
  'sales.invoice.update',
  'sales.return.read',
  'sales.return.create',
  'sales.return.update',
  'sales.credit_note.read',
  'sales.credit_note.create',
  'sales.credit_note.update',
  'sales.reporting.read',
  'branch.read',
];

function buildSeed(name: string, suffix: string, permissions: string[]) {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`.slice(0, 60);
  return {
    tenant: {
      name: `${name} ${suffix}`,
      displayName: `${name} ${suffix}`,
      subdomain: slug,
      slug,
      timezone: 'UTC',
      currency: 'USD',
      locale: 'en_US',
    },
    Tenant: { code: `${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}${suffix}`.slice(0, 18), name: `${name} ${suffix}`, fiscalCalendar: 'standard' },
    branch: { code: `${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}${suffix}`.slice(0, 15), name: `${name} Branch ${suffix}`, city: 'Bengaluru', country: 'IN' },
    administrator: {
      username: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`.slice(0, 50),
      email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}@example.com`,
      password: 'Password123!',
    },
    role: { code: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`.slice(0, 20), name: `${name} Admin ${suffix}` },
    permissions,
    subscriptionPlanName: 'Starter',
    initialFinancialYear: { name: `FY-${suffix}`, startDate: '2026-04-01', endDate: '2027-03-31' },
  };
}

async function login(app: Awaited<ReturnType<typeof createApplication>>, seed: ReturnType<typeof buildSeed>, tenantId: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: seed.tenant.subdomain, 'x-tenant-id': tenantId },
    payload: { identifier: seed.administrator.username, password: seed.administrator.password },
  });
  expect(response.statusCode).toBe(200);
  const body = response.json() as { accessToken: string; session: { financialYearId: string | null } };
  expect(body.session.financialYearId).toEqual(expect.any(String));
  return body.accessToken;
}

describe('Sales authorization proof', () => {
  let pool: Pool | undefined;
  let adminPool: Pool | undefined;
  let app: Awaited<ReturnType<typeof createApplication>> | undefined;

  afterAll(async () => {
    await app?.close();
    await pool?.end();
    await adminPool?.end();
  });

  runIfDatabase('proves Sales authentication, entitlement, RBAC, tenant/branch scope, reporting scope, and RLS', async () => {
    pool = createIntegrationApplicationPool();
    adminPool = createIntegrationAdminPool();
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const platformBootstrapService = new PlatformBootstrapService(repository);
    const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);
    await platformBootstrapService.seedReferenceData();

    const suffix = `${Date.now()}-${uuidV7()}`;
    const tenantASeed = buildSeed('Sales Tenant A', suffix, salesPermissions);
    const tenantBSeed = buildSeed('Sales Tenant B', suffix, salesPermissions);
    const missingSeed = buildSeed('Sales Missing Permission', suffix, ['branch.read']);
    const disabledSeed = buildSeed('Sales Disabled Module', suffix, salesPermissions);
    const tenantA = await tenantBootstrapService.bootstrapTenant(tenantASeed);
    const tenantB = await tenantBootstrapService.bootstrapTenant(tenantBSeed);
    const missing = await tenantBootstrapService.bootstrapTenant(missingSeed);
    const disabled = await tenantBootstrapService.bootstrapTenant(disabledSeed);
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

    const tenantAToken = await login(app, tenantASeed, tenantA.tenantId);
    const missingToken = await login(app, missingSeed, missing.tenantId);
    const disabledToken = await login(app, disabledSeed, disabled.tenantId);
    const tenantHeaders = (token: string, tenantId: string) => ({
      authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
    });

    expect((await app.inject({ method: 'GET', url: '/api/v1/sales/quotations' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/sales/orders/${uuidV7()}` })).statusCode).toBe(401);

    const platformEmail = `sales-proof-platform-${suffix}@example.com`;
    const platformPassword = 'SalesProofPlatformPassword123!';
    const identity = await adminPool.query<{ id: string }>(`INSERT INTO identities (status) VALUES ('active') RETURNING id`);
    await adminPool.query(
      `INSERT INTO auth_login_identifiers (identifier_type, identifier, tenant_id, user_id, identity_id, is_active)
       VALUES ('email', $1::citext, NULL, NULL, $2, true)`,
      [platformEmail, identity.rows[0].id],
    );
    await adminPool.query(
      `INSERT INTO identity_credentials (identity_id, provider, credential_type, secret_hash, password_changed_at)
       VALUES ($1, 'local', 'password', $2, now())`,
      [identity.rows[0].id, await passwordHasher.hash(platformPassword)],
    );
    const membership = await adminPool.query<{ id: string }>(
      `INSERT INTO platform_memberships (identity_id, status, activated_at) VALUES ($1, 'active', now()) RETURNING id`,
      [identity.rows[0].id],
    );
    const role = await adminPool.query<{ id: string }>(
      `SELECT id FROM platform_roles WHERE code = 'platform_owner' AND is_system = true`,
    );
    await adminPool.query(
      `INSERT INTO platform_membership_roles (platform_membership_id, platform_role_id) VALUES ($1, $2)`,
      [membership.rows[0].id, role.rows[0].id],
    );
    const platformLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/platform-login',
      payload: { identifier: platformEmail, password: platformPassword },
    });
    expect(platformLogin.statusCode).toBe(200);
    const platformToken = platformLogin.json().accessToken as string;
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/sales/quotations', headers: { authorization: `Bearer ${platformToken}` } })).statusCode,
    ).toBe(401);

    expect((await app.inject({ method: 'GET', url: '/api/v1/sales/quotations', headers: tenantHeaders(missingToken, missing.tenantId) })).statusCode).toBe(403);
    const salesModule = await adminPool.query<{ id: string }>(`SELECT id FROM modules WHERE code = 'sales' LIMIT 1`);
    await adminPool.query(
      `UPDATE tenant_modules SET enabled = false, disabled_at = NOW(), disabled_by = NULL
       WHERE tenant_id = $1 AND module_id = $2`,
      [disabled.tenantId, salesModule.rows[0].id],
    );
    expect((await app.inject({ method: 'GET', url: '/api/v1/sales/quotations', headers: tenantHeaders(disabledToken, disabled.tenantId) })).statusCode).toBe(403);

    const customer = uuidV7();
    const customerB = uuidV7();
    const quotation = uuidV7();
    const branchA2 = uuidV7();
    const quotationA2 = uuidV7();
    const quotationB = uuidV7();
    await adminPool.query(
      `INSERT INTO branches (id, tenant_id, code, name, status, is_head_office, is_default, city, country, timezone)
       VALUES ($1, $2, $3, $4, 'active', false, false, 'Bengaluru', 'IN', 'UTC')`,
      [branchA2, tenantA.tenantId, `A2-${suffix}`.slice(0, 20), `Sales Tenant A Branch 2 ${suffix}`],
    );
    const financialYear = await adminPool.query<{ id: string }>(
      `SELECT id
         FROM financial_years
        WHERE tenant_id = $1
          AND is_active = true
          AND is_deleted = false
        LIMIT 1`,
      [tenantA.tenantId],
    );
    expect(financialYear.rows).toHaveLength(1);
    await adminPool.query(`INSERT INTO customers (id, tenant_id, name) VALUES ($1, $2, $3)`, [
      customer,
      tenantA.tenantId,
      `Sales customer ${suffix}`,
    ]);
    await adminPool.query(`INSERT INTO customers (id, tenant_id, name) VALUES ($1, $2, $3)`, [
      customerB,
      tenantB.tenantId,
      `Sales customer B ${suffix}`,
    ]);
    await adminPool.query(
      `INSERT INTO sales_quotations
       (id, tenant_id, quotation_number, customer_id, quotation_date, valid_until, branch_id, financial_year_id, created_by)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + 30, $5, $6, $7)`,
      [quotation, tenantA.tenantId, `SQ-${suffix}`.slice(0, 50), customer, tenantA.branchId, financialYear.rows[0].id, tenantA.userId],
    );
    await adminPool.query(
      `INSERT INTO sales_quotations
       (id, tenant_id, quotation_number, customer_id, quotation_date, valid_until, branch_id, financial_year_id, created_by)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + 30, $5, $6, $7)`,
      [quotationA2, tenantA.tenantId, `SQ2-${suffix}`.slice(0, 50), customer, branchA2, financialYear.rows[0].id, tenantA.userId],
    );
    const financialYearB = await adminPool.query<{ id: string }>(
      `SELECT id
         FROM financial_years
        WHERE tenant_id = $1
          AND is_active = true
          AND is_deleted = false
        LIMIT 1`,
      [tenantB.tenantId],
    );
    expect(financialYearB.rows).toHaveLength(1);
    await adminPool.query(
      `INSERT INTO sales_quotations
       (id, tenant_id, quotation_number, customer_id, quotation_date, valid_until, branch_id, financial_year_id, created_by)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + 30, $5, $6, $7)`,
      [quotationB, tenantB.tenantId, `SQB-${suffix}`.slice(0, 50), customerB, tenantB.branchId, financialYearB.rows[0].id, tenantB.userId],
    );

    const tenantAList = await app.inject({
      method: 'GET',
      url: '/api/v1/sales/quotations',
      headers: tenantHeaders(tenantAToken, tenantA.tenantId),
    });
    expect(tenantAList.statusCode).toBe(200);
    expect(tenantAList.json().quotations.map((item: { id: string }) => item.id)).toContain(quotation);

    const tenantBGet = await app.inject({
      method: 'GET',
      url: `/api/v1/sales/quotations/${quotation}`,
      headers: tenantHeaders(await login(app, tenantBSeed, tenantB.tenantId), tenantB.tenantId),
    });
    expect([403, 404]).toContain(tenantBGet.statusCode);
    expect(tenantBGet.json().quotation).toBeUndefined();

    const tenantBDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sales/quotations/${quotation}`,
      headers: tenantHeaders(await login(app, tenantBSeed, tenantB.tenantId), tenantB.tenantId),
    });
    expect([403, 404]).toContain(tenantBDelete.statusCode);
    const tenantBUpdate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sales/quotations/${quotation}`,
      headers: tenantHeaders(await login(app, tenantBSeed, tenantB.tenantId), tenantB.tenantId),
      payload: {
        customerId: customerB,
        quotationDate: new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        items: [{ description: 'Unauthorized update', quantity: 1, unitPrice: 1, unitOfMeasure: 'EA' }],
        expectedVersion: 1,
      },
    });
    expect([403, 404]).toContain(tenantBUpdate.statusCode);
    const unchanged = await adminPool.query<{ notes: string | null; is_deleted: boolean }>(
      `SELECT notes, is_deleted FROM sales_quotations WHERE id = $1 AND tenant_id = $2`,
      [quotation, tenantA.tenantId],
    );
    expect(unchanged.rows[0].notes).toBeNull();
    expect(unchanged.rows[0].is_deleted).toBe(false);

    const tenantSpoofedList = await app.inject({
      method: 'GET',
      url: '/api/v1/sales/quotations',
      headers: tenantHeaders(tenantAToken, tenantB.tenantId),
    });
    expect(tenantSpoofedList.statusCode).toBe(200);
    expect(tenantSpoofedList.json().quotations.map((item: { id: string }) => item.id)).toContain(quotation);

    const crossBranchGet = await app.inject({
      method: 'GET',
      url: `/api/v1/sales/quotations/${quotationA2}`,
      headers: tenantHeaders(tenantAToken, tenantA.tenantId),
    });
    expect([403, 404]).toContain(crossBranchGet.statusCode);
    expect(crossBranchGet.json().quotation).toBeUndefined();

    const crossBranchDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sales/quotations/${quotationA2}`,
      headers: tenantHeaders(tenantAToken, tenantA.tenantId),
    });
    expect([403, 404]).toContain(crossBranchDelete.statusCode);
    const branchState = await adminPool.query<{ is_deleted: boolean }>(
      `SELECT is_deleted FROM sales_quotations WHERE id = $1 AND tenant_id = $2`,
      [quotationA2, tenantA.tenantId],
    );
    expect(branchState.rows[0].is_deleted).toBe(false);

    const report = await app.inject({
      method: 'GET',
      url: '/api/v1/sales/reports/document-summary',
      headers: tenantHeaders(tenantAToken, tenantA.tenantId),
    });
    expect(report.statusCode).toBe(200);
    const reportBody = report.json() as { documents: Array<{ documentId: string }> };
    expect(reportBody.documents.map((item) => item.documentId)).toContain(quotation);
    expect(reportBody.documents.map((item) => item.documentId)).not.toContain(quotationA2);
    expect(reportBody.documents.map((item) => item.documentId)).not.toContain(quotationB);

    const rlsVisible = await withTenantContext(pool, 'app.current_tenant_id', tenantA.tenantId, (client) =>
      client.query(`SELECT id FROM sales_quotations WHERE id = $1`, [quotation]),
    );
    expect(rlsVisible.rows).toHaveLength(1);
    const rlsHidden = await withTenantContext(pool, 'app.current_tenant_id', tenantB.tenantId, (client) =>
      client.query(`SELECT id FROM sales_quotations WHERE id = $1`, [quotation]),
    );
    expect(rlsHidden.rows).toHaveLength(0);
    await expect(pool.query(`SELECT id FROM sales_quotations WHERE id = $1`, [quotation])).rejects.toMatchObject({ code: '22P02' });
  });
});

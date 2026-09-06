import { afterAll, describe, expect, it } from 'vitest';
import { v7 as uuidV7 } from 'uuid';

import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';
import { createTestApp, createTestPool } from '../helpers/test-app.js';

const runIfDatabase = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL ? it : it.skip;

describe('Purchase HTTP API', () => {
  let pool: ReturnType<typeof createTestPool> | undefined;
  let app: Awaited<ReturnType<typeof createTestApp>> | undefined;

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  runIfDatabase('enforces supplier CRUD, soft delete, optimistic versioning, and auth', async () => {
    pool = createTestPool();
    const repository = new PostgresPlatformRepository(pool);
    await new PlatformBootstrapService(repository).seedReferenceData();
    const suffix = `${Date.now()}-${uuidV7()}`;
    const input = {
      tenant: { name: `Purchase API Tenant ${suffix}`, subdomain: `purchase-${suffix}`, slug: `purchase-${suffix}` },
      organization: { code: `P${suffix}`.slice(0, 18), name: 'Purchase Organization' },
      branch: { code: `PB${suffix}`.slice(0, 15), name: 'Head Office' },
      administrator: {
        username: `purchase-admin-${suffix}`,
        email: `purchase-admin-${suffix}@example.com`,
        password: 'Password123!',
      },
      role: { code: `purchase-admin-${suffix}`.slice(0, 20), name: 'Purchase Administrator' },
      permissions: [],
      subscriptionPlanName: 'Starter',
    };
    const bootstrap = await new TenantBootstrapService(repository, new BcryptPasswordHasher()).bootstrapTenant(input);
    await withTenantContext(pool, 'app.current_tenant_id', bootstrap.tenantId, async (client) => {
      await client.query(
        `INSERT INTO financial_years (id,tenant_id,organization_id,name,start_date,end_date,is_active,status,is_locked)
         VALUES ($1,$2,$3,'FY 2026','2026-01-01','2026-12-31',true,'open',false)`,
        [uuidV7(), bootstrap.tenantId, bootstrap.organizationId],
      );
      const module = await client.query(`SELECT id FROM modules WHERE code='purchase'`);
      const moduleId = module.rows[0]?.id;
      if (!moduleId) throw new Error('Purchase module seed is missing.');
      await client.query(
        `INSERT INTO tenant_modules(id,tenant_id,module_id,enabled,enabled_at) VALUES($1,$2,$3,true,NOW())
         ON CONFLICT (tenant_id,module_id) DO UPDATE SET enabled=true,disabled_at=NULL`,
        [uuidV7(), bootstrap.tenantId, moduleId],
      );
      await client.query(
        `INSERT INTO organization_modules(id,tenant_id,organization_id,module_id,enabled,enabled_at) VALUES($1,$2,$3,$4,true,NOW())
         ON CONFLICT (organization_id,module_id) DO UPDATE SET enabled=true,disabled_at=NULL`,
        [uuidV7(), bootstrap.tenantId, bootstrap.organizationId, moduleId],
      );
      await client.query(
        `INSERT INTO user_permissions(tenant_id,user_id,permission_id,allow)
         SELECT $1,$2,id,true FROM permissions WHERE module_code='purchase'
         ON CONFLICT (tenant_id,user_id,permission_id) DO UPDATE SET allow=true`,
        [bootstrap.tenantId, bootstrap.userId],
      );
    });

    app = await createTestApp(pool);
    expect((await app.inject({ method: 'GET', url: '/api/v1/purchase/suppliers' })).statusCode).toBe(401);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-id': bootstrap.tenantId },
      payload: { identifier: input.administrator.username, password: input.administrator.password },
    });
    expect(login.statusCode).toBe(200);
    const headers = { authorization: `Bearer ${login.json().accessToken}`, 'x-tenant-id': uuidV7() };

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/purchase/suppliers',
      headers,
      payload: { name: '   ', code: 'SUP-INVALID' },
    });
    expect(invalid.statusCode).toBe(400);

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/purchase/suppliers',
      headers,
      payload: { name: '  Acme Supplier  ', code: `SUP-${uuidV7().slice(0, 8)}` },
    });
    expect(created.statusCode, created.body).toBe(201);
    const supplier = created.json().supplier;
    expect(supplier.name).toBe('Acme Supplier');

    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/purchase/suppliers/${supplier.id}`,
      headers,
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().supplier.id).toBe(supplier.id);
    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/purchase/suppliers/${supplier.id}`,
      headers,
      payload: {
        name: 'Updated Supplier',
        email: 'updated@example.com',
        expectedVersion: supplier.version ?? 1,
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().supplier.name).toBe('Updated Supplier');

    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/v1/purchase/suppliers/${supplier.id}`,
      headers,
      payload: { name: 'Stale', expectedVersion: 999 },
    });
    expect(stale.statusCode).toBe(404);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/purchase/suppliers/${supplier.id}`,
      headers,
      payload: { expectedVersion: updated.json().supplier.version ?? 2 },
    });
    expect(deleted.statusCode).toBe(200);
    const listed = await app.inject({ method: 'GET', url: '/api/v1/purchase/suppliers', headers });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().suppliers.some((item: { id: string }) => item.id === supplier.id)).toBe(false);
  });
});

import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 } from 'uuid';

import { AuthenticationService } from '../../src/application/services/authentication-service.js';
import { AuthorizationService } from '../../src/application/services/authorization-service.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const runIfDatabase = databaseUrl ? it : it.skip;

describe('Phase 2 platform and identity foundation', () => {
  let pool: Pool | undefined;

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  runIfDatabase('bootstraps a tenant and secures its identity boundaries', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const bootstrapService = new PlatformBootstrapService(repository);
    const tenantService = new TenantBootstrapService(repository, passwordHasher);
    const authService = new AuthenticationService(repository, passwordHasher);
    const authorizationService = new AuthorizationService(repository);

    await bootstrapService.seedReferenceData();

    const uniqueSuffix = Date.now();
    const tenantInput = {
      tenant: {
        name: `Bootstrap Tenant ${uniqueSuffix}`,
        displayName: `Bootstrap Tenant ${uniqueSuffix}`,
        subdomain: `tenant-${uniqueSuffix}`,
        slug: `tenant-${uniqueSuffix}`,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en_US',
      },
      organization: {
        code: `ORG${uniqueSuffix}`,
        name: `Org ${uniqueSuffix}`,
        fiscalCalendar: 'standard',
      },
      branch: {
        code: `BR${uniqueSuffix}`,
        name: `Branch ${uniqueSuffix}`,
        city: 'Bengaluru',
        country: 'IN',
      },
      administrator: {
        username: `admin${uniqueSuffix}`,
        email: `admin${uniqueSuffix}@example.com`,
        password: 'Password123!',
      },
      role: {
        code: `admin${uniqueSuffix}`,
        name: `Administrator ${uniqueSuffix}`,
      },
      permissions: ['role.manage', 'user.manage', 'session.manage', 'organization.manage', 'branch.manage'],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: {
        name: `FY-${uniqueSuffix}`,
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
    };

    const result = await tenantService.bootstrapTenant(tenantInput);

    expect(result.tenantId).toBeTruthy();
    expect(result.organizationId).toBeTruthy();
    expect(result.branchId).toBeTruthy();
    expect(result.userId).toBeTruthy();
    expect(result.roleId).toBeTruthy();

    const tenantRow = await pool.query('SELECT id FROM tenants WHERE id = $1', [result.tenantId]);
    expect(tenantRow.rowCount).toBe(1);

    // Run tenant-scoped verification queries within a tenant context so RLS using current_setting('app.current_tenant_id') succeeds
    const scoped = await (async () => {
      const { withTenantContext } = await import('../../src/infrastructure/database/tenant-context.js');
      return withTenantContext(pool, 'app.current_tenant_id', result.tenantId, async (client) => {
        const organizationRow = await client.query('SELECT id FROM organizations WHERE tenant_id = $1', [result.tenantId]);
        const branchRow = await client.query('SELECT id FROM branches WHERE tenant_id = $1', [result.tenantId]);
        const userRow = await client.query('SELECT id, password_hash FROM users WHERE tenant_id = $1 AND id = $2', [result.tenantId, result.userId]);
        const rolePermissionsCount = await client.query('SELECT COUNT(*)::int AS count FROM role_permissions WHERE tenant_id = $1 AND role_id = $2', [result.tenantId, result.roleId]);
        const orgAccess = await client.query('SELECT COUNT(*)::int AS count FROM user_organization_access WHERE tenant_id = $1 AND user_id = $2', [result.tenantId, result.userId]);
        const branchAccess = await client.query('SELECT COUNT(*)::int AS count FROM user_branch_access WHERE tenant_id = $1 AND user_id = $2', [result.tenantId, result.userId]);
        return { organizationRow, branchRow, userRow, rolePermissionsCount, orgAccess, branchAccess };
      });
    })();

    expect(scoped.organizationRow.rowCount).toBe(1);
    expect(scoped.branchRow.rowCount).toBe(1);
    expect(scoped.userRow.rowCount).toBe(1);
    expect(scoped.userRow.rows[0].password_hash).not.toBe('Password123!');
    expect(scoped.rolePermissionsCount.rows[0].count).toBeGreaterThan(0);
    expect(scoped.orgAccess.rows[0].count).toBe(1);
    expect(scoped.branchAccess.rows[0].count).toBe(1);

    await expect(authorizationService.hasPermission(result.tenantId, result.userId, 'role.manage')).resolves.toBe(true);
    await expect(authorizationService.hasPermission(result.tenantId, result.userId, 'permission.manage')).resolves.toBe(false);

    const authResult = await authService.authenticate(result.tenantId, tenantInput.administrator.username, tenantInput.administrator.password);
    expect(authResult.success).toBe(true);
    expect(authResult.session).toBeDefined();
    expect(authResult.session?.tenantId).toBe(result.tenantId);

    await authService.invalidateSession(authResult.session!.id, result.tenantId);
    const sessionRow = await (async () => {
      const { withTenantContext } = await import('../../src/infrastructure/database/tenant-context.js');
      return withTenantContext(pool, 'app.current_tenant_id', result.tenantId, async (client) => {
        return client.query('SELECT is_active FROM user_sessions WHERE id = $1 AND tenant_id = $2', [authResult.session!.id, result.tenantId]);
      });
    })();
    expect(sessionRow.rowCount).toBe(1);
    expect(sessionRow.rows[0].is_active).toBe(false);
  });

  runIfDatabase('rolls back a tenant bootstrap when a unique validation fails', async () => {
    if (!pool) {
      pool = new Pool({ connectionString: databaseUrl! });
    }

    const repository = new PostgresPlatformRepository(pool);
    const passwordHasher = new BcryptPasswordHasher();
    const service = new TenantBootstrapService(repository, passwordHasher);

    const suffix = `rollback-${Date.now()}-${v7()}`;
    const tenantSeed = {
      tenant: {
        name: `Rollback ${suffix}`,
        subdomain: `rollback-${suffix}`,
        slug: `rollback-${suffix}`,
      },
      organization: { code: `ROLL${suffix}`.slice(0, 20), name: `Rollback Org ${suffix}` },
      branch: { code: `RB${suffix}`.slice(0, 15), name: `Rollback Branch ${suffix}` },
      administrator: {
        username: `rollbackadmin${suffix}`,
        email: `rollbackadmin${suffix}@example.com`,
        password: 'Password123!',
      },
      role: { code: `rb${suffix}`.slice(0, 20), name: `Rollback Role ${suffix}` },
      permissions: ['role.manage', 'user.manage'],
    };

    try {
      await service.bootstrapTenant(tenantSeed);
      await service.bootstrapTenant({
        ...tenantSeed,
        tenant: { ...tenantSeed.tenant, subdomain: tenantSeed.tenant.subdomain, slug: tenantSeed.tenant.slug },
      });
      throw new Error('Expected tenant bootstrap to fail on duplicate unique tenant slug.');
    } catch (error) {
      const rows = await pool.query('SELECT COUNT(*)::int AS count FROM tenants WHERE slug = $1', [tenantSeed.tenant.slug]);
      expect(rows.rows[0].count).toBe(1);
    }
  });
});

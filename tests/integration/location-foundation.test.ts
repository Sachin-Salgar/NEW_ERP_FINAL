import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });

async function seedTenant(pool: Pool, suffix: string) {
  const repository = new PostgresPlatformRepository(pool);
  const passwordHasher = new BcryptPasswordHasher();
  const platformBootstrapService = new PlatformBootstrapService(repository);
  const tenantBootstrapService = new TenantBootstrapService(repository, passwordHasher);

  await platformBootstrapService.seedReferenceData();

  const tenantInput = {
    tenant: {
      name: `Location Tenant ${suffix}`,
      displayName: `Location Tenant ${suffix}`,
      subdomain: `location-${suffix}`,
      slug: `location-${suffix}`,
      timezone: 'UTC',
      currency: 'USD',
      locale: 'en_US',
    },
    organization: {
      code: `LOC${suffix}`.slice(0, 18),
      name: `Location Org ${suffix}`,
      fiscalCalendar: 'standard',
    },
    branch: {
      code: `BR-${suffix}`.slice(0, 15),
      name: `Location Branch ${suffix}`,
      city: 'Pune',
      country: 'IN',
    },
    administrator: {
      username: `locadmin${suffix}`,
      email: `locadmin${suffix}@example.com`,
      password: 'Password123!',
    },
    role: {
      code: `locadmin${suffix}`.slice(0, 20),
      name: `Location Admin ${suffix}`,
    },
    permissions: [
      'organization.read',
      'organization.manage',
      'branch.read',
      'branch.manage',
      'user.read',
      'user.manage',
      'role.manage',
      'role.read',
      'permission.read',
    ],
    subscriptionPlanName: 'Starter',
    initialFinancialYear: {
      name: `FY-${suffix}`,
      startDate: '2026-04-01',
      endDate: '2027-03-31',
    },
  };

  const bootstrapResult = await tenantBootstrapService.bootstrapTenant(tenantInput);
  return { repository, bootstrapResult };
}

describe('Location foundation', () => {
  let pool: Pool | undefined;

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('creates and lists locations inside the correct tenant and organization scope', async () => {
    if (!databaseUrl) {
      return;
    }

    pool = new Pool({ connectionString: databaseUrl });
    const suffix = `${Date.now()}-${uuidV7()}`;
    const { repository, bootstrapResult } = await seedTenant(pool, suffix);

    const location = await repository.createLocation(bootstrapResult.tenantId, bootstrapResult.organizationId, {
      code: `PL-${suffix}`.slice(0, 15),
      name: `Plant ${suffix}`,
      description: 'Primary manufacturing plant',
      status: 'active',
      isDefault: true,
      city: 'Pune',
      state: 'Maharashtra',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    });

    expect(location.tenantId).toBe(bootstrapResult.tenantId);
    expect(location.organizationId).toBe(bootstrapResult.organizationId);
    expect(location.name).toContain('Plant');

    const listedLocations = await repository.listLocations(bootstrapResult.tenantId, bootstrapResult.organizationId);
    expect(listedLocations.some((item) => item.id === location.id)).toBe(true);

    const fetchedLocation = await repository.getLocationById(
      bootstrapResult.tenantId,
      bootstrapResult.organizationId,
      location.id,
    );
    expect(fetchedLocation?.id).toBe(location.id);
    expect(fetchedLocation?.tenantId).toBe(bootstrapResult.tenantId);
  });

  it('creates user location access with the user organization and preserves tenant isolation', async () => {
    if (!databaseUrl) {
      return;
    }

    pool = new Pool({ connectionString: databaseUrl });
    const suffix = `${Date.now()}-${uuidV7()}`;
    const firstTenant = await seedTenant(pool, `user-location-${suffix}`);
    const secondTenant = await seedTenant(pool, `user-location-other-${suffix}`);
    const passwordHasher = new BcryptPasswordHasher();
    const location = await firstTenant.repository.createLocation(
      firstTenant.bootstrapResult.tenantId,
      firstTenant.bootstrapResult.organizationId,
      {
        code: `ULA-${suffix}`.slice(0, 15),
        name: `User Location ${suffix}`,
        status: 'active',
      },
    );
    const userId = uuidV7();
    const user = await firstTenant.repository.createUser({
      id: userId,
      tenantId: firstTenant.bootstrapResult.tenantId,
      organizationId: firstTenant.bootstrapResult.organizationId,
      defaultBranchId: firstTenant.bootstrapResult.branchId,
      defaultLocationId: location.id,
      username: `userlocation${suffix}`,
      email: `userlocation${suffix}@example.com`,
      passwordHash: await passwordHasher.hash('Password123!'),
      status: 'active',
    });

    const ownTenantAccess = await withTenantContext(
      pool,
      'app.current_tenant_id',
      firstTenant.bootstrapResult.tenantId,
      async (client) =>
        client.query(
          `SELECT tenant_id as "tenantId", user_id as "userId", organization_id as "organizationId", location_id as "locationId"
           FROM user_location_access
           WHERE tenant_id = $1 AND user_id = $2`,
          [firstTenant.bootstrapResult.tenantId, user.id],
        ),
    );
    expect(ownTenantAccess.rows).toEqual([
      {
        tenantId: firstTenant.bootstrapResult.tenantId,
        userId: user.id,
        organizationId: firstTenant.bootstrapResult.organizationId,
        locationId: location.id,
      },
    ]);

    const otherTenantAccess = await withTenantContext(
      pool,
      'app.current_tenant_id',
      secondTenant.bootstrapResult.tenantId,
      async (client) =>
        client.query(
          `SELECT user_id as "userId"
           FROM user_location_access
           WHERE user_id = $1`,
          [user.id],
        ),
    );
    expect(otherTenantAccess.rows).toHaveLength(0);
  });

  it('rejects location records that pair an organization from a different tenant', async () => {
    if (!databaseUrl) {
      return;
    }

    pool = new Pool({ connectionString: databaseUrl });
    const suffix = `${Date.now()}-${uuidV7()}`;
    const firstTenant = await seedTenant(pool, `first-${suffix}`);
    const secondTenant = await seedTenant(pool, `second-${suffix}`);

    await expect(
      firstTenant.repository.createLocation(
        firstTenant.bootstrapResult.tenantId,
        secondTenant.bootstrapResult.organizationId,
        {
          code: `BAD-${suffix}`.slice(0, 15),
          name: 'Invalid location',
        },
      ),
    ).rejects.toThrow();
  });

  it('soft-deletes locations and removes them from active tenant and organization scope', async () => {
    if (!databaseUrl) {
      return;
    }

    pool = new Pool({ connectionString: databaseUrl });
    const suffix = `${Date.now()}-${uuidV7()}`;
    const { repository, bootstrapResult } = await seedTenant(pool, suffix);

    const location = await repository.createLocation(bootstrapResult.tenantId, bootstrapResult.organizationId, {
      code: `PL2-${suffix}`.slice(0, 15),
      name: `Plant 2 ${suffix}`,
      status: 'active',
    });

    const deactivated = await repository.deactivateLocation(
      bootstrapResult.tenantId,
      bootstrapResult.organizationId,
      location.id,
    );
    expect(deactivated).toBe(true);
    expect(await repository.listLocations(bootstrapResult.tenantId, bootstrapResult.organizationId)).not.toContainEqual(
      expect.objectContaining({ id: location.id }),
    );
    expect(
      await repository.getLocationById(bootstrapResult.tenantId, bootstrapResult.organizationId, location.id),
    ).toBeNull();
  });
});

import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';
import { resolveDatabaseUrl } from './src/config/schema.ts';
import { PlatformBootstrapService } from './src/application/services/platform-bootstrap-service.ts';
import { TenantBootstrapService } from './src/application/services/tenant-bootstrap-service.ts';
import { BcryptPasswordHasher } from './src/infrastructure/security/bcrypt-password-hasher.ts';
import { PostgresPlatformRepository } from './src/infrastructure/database/repositories/postgres-platform-repository.ts';
import { UnitOfWork } from './src/infrastructure/database/unit-of-work.ts';

async function main() {
    const databaseUrl = resolveDatabaseUrl(process.env);

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not configured. Set DATABASE_URL in .env.local. The application will not create or select another database automatically.',
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const repo = new PostgresPlatformRepository(pool);
  const platformBootstrap = new PlatformBootstrapService(repo);
  const tenantBootstrap = new TenantBootstrapService(repo, new BcryptPasswordHasher(), new UnitOfWork(pool));

  const uniqueSuffix = `${Date.now()}-${uuidV7()}`;
  const provider = {
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
    permissions: [
      'organization.read', 'organization.manage',
      'branch.read', 'branch.manage',
      'user.read', 'user.manage',
      'role.manage', 'role.read', 'permission.read',
    ],
    subscriptionPlanName: 'Starter',
    initialFinancialYear: {
      name: `FY-${uniqueSuffix}`,
      startDate: '2026-04-01',
      endDate: '2027-03-31',
    },
  };

  await platformBootstrap.seedReferenceData();
  const result = await tenantBootstrap.bootstrapTenant(provider);
  console.log(JSON.stringify({
    tenantId: result.tenantId,
    organizationId: result.organizationId,
    branchId: result.branchId,
    userId: result.userId,
    username: provider.administrator.username,
    email: provider.administrator.email,
    password: provider.administrator.password,
  }, null, 2));
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

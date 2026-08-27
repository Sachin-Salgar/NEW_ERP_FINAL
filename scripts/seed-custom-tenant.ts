import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { resolveDatabaseUrl } from '../src/config/schema.ts';
import { PlatformBootstrapService } from '../src/application/services/platform-bootstrap-service.ts';
import { TenantBootstrapService } from '../src/application/services/tenant-bootstrap-service.ts';
import { BcryptPasswordHasher } from '../src/infrastructure/security/bcrypt-password-hasher.ts';
import { PostgresPlatformRepository } from '../src/infrastructure/database/repositories/postgres-platform-repository.ts';

/**
 * One-time/manual bootstrap for the real deployment test tenant.
 *
 * IMPORTANT: the admin password is never stored in source control.
 * Set ADMIN_PASSWORD in the environment before running this script.
 */
async function main() {
  const databaseUrl = resolveDatabaseUrl(process.env);
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();

  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD is required. Set it in the environment; do not put it in source control.');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const repository = new PostgresPlatformRepository(pool);
  const platformBootstrap = new PlatformBootstrapService(repository);
  const tenantBootstrap = new TenantBootstrapService(repository, new BcryptPasswordHasher());

  const tenantId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1001';
  const organizationId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1002';
  const branchId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1003';
  const adminId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1004';
  const roleId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1005';

  const provider = {
    tenant: {
      id: tenantId,
      name: 'Magod Fusion',
      displayName: 'Magod Fusion',
      subdomain: 'magodfusion',
      slug: 'magodfusion',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      locale: 'en_IN',
      status: 'active' as const,
    },
    organization: {
      id: organizationId,
      code: 'MAGOD',
      name: 'Magod Fusion',
      email: 'admin@magodfusion.in',
      baseCurrency: 'INR',
      fiscalCalendar: 'standard',
      status: 'active' as const,
      isDefault: true,
    },
    branch: {
      id: branchId,
      code: 'PUNE',
      name: 'Pune',
      status: 'active' as const,
      isHeadOffice: true,
      isDefault: true,
      city: 'Pune',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    },
    administrator: {
      id: adminId,
      username: 'admin',
      email: 'admin@magodfusion.in',
      password: adminPassword,
      organizationId,
      defaultBranchId: branchId,
    },
    role: {
      id: roleId,
      code: 'tenant-admin',
      name: 'Tenant Administrator',
      description: 'Administrator for the deployment test tenant.',
      isSystem: false,
    },
    permissions: [
      'tenant.read',
      'tenant.manage',
      'organization.read',
      'organization.manage',
      'branch.read',
      'branch.manage',
      'user.read',
      'user.manage',
      'role.read',
      'role.manage',
      'permission.read',
      'permission.manage',
      'session.manage',
    ],
    subscriptionPlanName: 'Starter',
    initialFinancialYear: {
      name: 'FY-2026-27',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      status: 'open' as const,
      isActive: true,
    },
  };

  console.log('Seeding platform reference data...');
  await platformBootstrap.seedReferenceData();

  console.log(`Bootstrapping tenant: ${provider.tenant.name}`);
  const result = await tenantBootstrap.bootstrapTenant(provider);

  console.log(JSON.stringify({
    tenantId: result.tenantId,
    tenantSlug: provider.tenant.slug,
    organizationId: result.organizationId,
    branchId: result.branchId,
    userId: result.userId,
    username: provider.administrator.username,
    email: provider.administrator.email,
  }, null, 2));

  await pool.end();
}

main().catch(async (error) => {
  console.error('Custom tenant seed failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});

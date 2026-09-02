import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { resolveDatabaseUrl } from '../src/config/schema.ts';
import { PlatformBootstrapService } from '../src/application/services/platform-bootstrap-service.ts';
import { TenantBootstrapService } from '../src/application/services/tenant-bootstrap-service.ts';
import { CoreEnterpriseService } from '../src/application/services/core-enterprise-service.ts';
import { BcryptPasswordHasher } from '../src/infrastructure/security/bcrypt-password-hasher.ts';
import { PostgresPlatformRepository } from '../src/infrastructure/database/repositories/postgres-platform-repository.ts';
import { withTenantContext } from '../src/infrastructure/database/tenant-context.ts';

/**
 * Manual bootstrap/restore for the real deployment test tenant.
 *
 * The script preserves the original deployment tenant/admin and ensures a
 * controlled multi-organization, multi-branch, multi-location dataset for
 * exercising the Organization -> Branch -> Location working-context flow.
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
  const coreEnterprise = new CoreEnterpriseService(repository);

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

  try {
    console.log('Seeding platform reference data...');
    await platformBootstrap.seedReferenceData();

    const existingTenant = await pool.query(
      'SELECT id FROM tenants WHERE id = $1 LIMIT 1',
      [tenantId],
    );

    let result: { tenantId: string; organizationId: string; branchId: string; userId: string };

    if (existingTenant.rows.length === 0) {
      console.log(`Bootstrapping tenant: ${provider.tenant.name}`);
      result = await tenantBootstrap.bootstrapTenant(provider);
    } else {
      console.log(`Tenant already exists: ${provider.tenant.name}; preserving existing tenant data.`);
      const admin = await repository.findByTenantAndIdentifier(tenantId, provider.administrator.username);
      if (!admin || admin.id !== adminId) {
        throw new Error(`Expected deployment administrator ${provider.administrator.username} (${adminId}) was not found in tenant ${tenantId}.`);
      }

      const organization = await repository.getOrganizationById(tenantId, organizationId);
      if (!organization || organization.isDeleted) {
        throw new Error(`Expected primary organization ${organizationId} was not found.`);
      }

      const branch = await repository.getBranchById(tenantId, organizationId, branchId);
      if (!branch || branch.isDeleted) {
        throw new Error(`Expected primary branch ${branchId} was not found.`);
      }

      result = {
        tenantId,
        organizationId,
        branchId,
        userId: admin.id,
      };
    }

    const primaryOrganization = await repository.getOrganizationById(tenantId, organizationId);
    if (!primaryOrganization) {
      throw new Error(`Primary organization ${organizationId} is missing after bootstrap/restore.`);
    }

    const primaryBranches = await repository.listBranches(tenantId, organizationId);
    let sambhajiNagarBranch = primaryBranches.find((branch) => branch.name === 'Chatrapati Sambhaji Nagar');
    if (!sambhajiNagarBranch) {
      sambhajiNagarBranch = await coreEnterprise.createBranch(tenantId, organizationId, {
        name: 'Chatrapati Sambhaji Nagar',
        status: 'active',
        isHeadOffice: false,
        isDefault: false,
        city: 'Chhatrapati Sambhajinagar',
        district: 'Chhatrapati Sambhajinagar',
        state: 'Maharashtra',
        country: 'IN',
        timezone: 'Asia/Kolkata',
      });
    }

    let secondaryOrganization = (await repository.listOrganizations(tenantId))
      .find((organization) => organization.name === 'Magod Fusion Manufacturing' && !organization.isDeleted);
    if (!secondaryOrganization) {
      secondaryOrganization = await coreEnterprise.createOrganization(tenantId, {
        name: 'Magod Fusion Manufacturing',
        baseCurrency: 'INR',
        fiscalCalendar: 'standard',
        status: 'active',
        isDefault: false,
        email: 'admin@magodfusion.in',
        remarks: 'Controlled working-context test organization.',
      });
    }

    const secondaryBranches = await repository.listBranches(tenantId, secondaryOrganization.id);
    let secondaryPuneBranch = secondaryBranches.find((branch) => branch.name === 'Pune Manufacturing');
    if (!secondaryPuneBranch) {
      secondaryPuneBranch = await coreEnterprise.createBranch(tenantId, secondaryOrganization.id, {
        name: 'Pune Manufacturing',
        status: 'active',
        isHeadOffice: true,
        isDefault: true,
        city: 'Pune',
        state: 'Maharashtra',
        country: 'IN',
        timezone: 'Asia/Kolkata',
      });
    }

    let secondaryMumbaiBranch = secondaryBranches.find((branch) => branch.name === 'Mumbai Manufacturing');
    if (!secondaryMumbaiBranch) {
      secondaryMumbaiBranch = await coreEnterprise.createBranch(tenantId, secondaryOrganization.id, {
        name: 'Mumbai Manufacturing',
        status: 'active',
        isHeadOffice: false,
        isDefault: false,
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'IN',
        timezone: 'Asia/Kolkata',
      });
    }

    async function ensureLocation(
      targetOrganizationId: string,
      name: string,
      city: string,
      makeDefaultIfMissing: boolean,
    ) {
      const locations = await repository.listLocations(tenantId, targetOrganizationId);
      const existing = locations.find((location) => location.name === name && !location.isDeleted);
      if (existing) {
        return existing;
      }

      const hasDefault = locations.some((location) => location.isDefault && !location.isDeleted);
      const code = await repository.generateLocationCode(tenantId, targetOrganizationId);
      return repository.createLocation(tenantId, targetOrganizationId, {
        code,
        name,
        status: 'active',
        isDefault: makeDefaultIfMissing && !hasDefault,
        city,
        state: 'Maharashtra',
        country: 'IN',
        timezone: 'Asia/Kolkata',
      });
    }

    const puneLocation = await ensureLocation(organizationId, 'Pune Plant', 'Pune', true);
    const sambhajiNagarLocation = await ensureLocation(organizationId, 'Chatrapati Sambhaji Nagar Plant', 'Chhatrapati Sambhajinagar', false);
    const manufacturingPuneLocation = await ensureLocation(secondaryOrganization.id, 'Pune Manufacturing Plant', 'Pune', true);
    const manufacturingMumbaiLocation = await ensureLocation(secondaryOrganization.id, 'Mumbai Manufacturing Plant', 'Mumbai', false);

    const admin = await repository.findByTenantAndIdentifier(tenantId, provider.administrator.username);
    if (!admin) {
      throw new Error(`Administrator ${provider.administrator.username} was not found after bootstrap/restore.`);
    }

    const requiredBranches = [
      await repository.getBranchById(tenantId, organizationId, branchId),
      sambhajiNagarBranch,
      secondaryPuneBranch,
      secondaryMumbaiBranch,
    ];

    for (const [organization, branches] of [
      [primaryOrganization, requiredBranches.slice(0, 2)],
      [secondaryOrganization, requiredBranches.slice(2)],
    ] as const) {
      const organizationAssigned = await coreEnterprise.assignUserToOrganization(tenantId, admin.id, organization.id);
      if (!organizationAssigned) {
        throw new Error(`Failed to ensure organization access for ${organization.name}.`);
      }

      for (const branch of branches) {
        if (!branch) {
          throw new Error('A required branch could not be resolved.');
        }
        const branchAssigned = await coreEnterprise.assignUserToBranch(tenantId, admin.id, branch.id);
        if (!branchAssigned) {
          throw new Error(`Failed to ensure branch access for ${branch.name}.`);
        }
      }
    }

    await withTenantContext(pool, 'app.current_tenant_id', tenantId, async (client) => {
      for (const location of [puneLocation, sambhajiNagarLocation, manufacturingPuneLocation, manufacturingMumbaiLocation]) {
        await client.query(
          `INSERT INTO user_location_access (tenant_id, user_id, organization_id, location_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, location_id, tenant_id) DO NOTHING`,
          [tenantId, admin.id, location.organizationId, location.id],
        );
      }
    });

    const primaryDefaultLocation = (await repository.listLocations(tenantId, organizationId))
      .find((location) => location.isDefault && !location.isDeleted) ?? puneLocation;

    const updatedAdmin = await coreEnterprise.updateUser(tenantId, admin.id, {
      organizationId,
      defaultBranchId: branchId,
      defaultLocationId: primaryDefaultLocation.id,
    });

    if (!updatedAdmin) {
      throw new Error('Failed to ensure administrator default working context.');
    }

    const organizationMemberships = await repository.findUserOrganizationMemberships(tenantId, admin.id);
    const accessiblePrimaryBranches = await repository.listAccessibleBranchesForUser(tenantId, admin.id, organizationId);
    const accessibleSecondaryBranches = await repository.listAccessibleBranchesForUser(tenantId, admin.id, secondaryOrganization.id);
    const accessiblePrimaryLocations = await repository.listAccessibleLocationsForUser(tenantId, admin.id, organizationId);
    const accessibleSecondaryLocations = await repository.listAccessibleLocationsForUser(tenantId, admin.id, secondaryOrganization.id);

    const allBranches = [...accessiblePrimaryBranches, ...accessibleSecondaryBranches];
    const allLocations = [...accessiblePrimaryLocations, ...accessibleSecondaryLocations];

    if (organizationMemberships.length < 2) {
      throw new Error(`Seed validation failed: expected at least 2 organization memberships, found ${organizationMemberships.length}.`);
    }
    if (allBranches.length < 4) {
      throw new Error(`Seed validation failed: expected at least 4 accessible branches, found ${allBranches.length}.`);
    }
    if (allLocations.length < 4) {
      throw new Error(`Seed validation failed: expected at least 4 accessible locations, found ${allLocations.length}.`);
    }
    if (updatedAdmin.organizationId !== organizationId || updatedAdmin.defaultBranchId !== branchId || updatedAdmin.defaultLocationId !== primaryDefaultLocation.id) {
      throw new Error('Seed validation failed: administrator default context is inconsistent.');
    }

    for (const branch of allBranches) {
      const organization = await repository.getOrganizationById(tenantId, branch.organizationId);
      if (!organization) {
        throw new Error(`Seed validation failed: branch ${branch.id} references a missing organization.`);
      }
    }

    for (const location of allLocations) {
      const organization = await repository.getOrganizationById(tenantId, location.organizationId);
      if (!organization) {
        throw new Error(`Seed validation failed: location ${location.id} references a missing organization.`);
      }
    }

    console.log(JSON.stringify({
      tenantId: result.tenantId,
      tenantSlug: provider.tenant.slug,
      organizationId: result.organizationId,
      branchId: result.branchId,
      userId: result.userId,
      username: provider.administrator.username,
      email: provider.administrator.email,
      workingContextTestData: {
        organizations: organizationMemberships.length,
        branches: allBranches.length,
        locations: allLocations.length,
        defaultOrganization: updatedAdmin.organizationId,
        defaultBranch: updatedAdmin.defaultBranchId,
        defaultLocation: updatedAdmin.defaultLocationId,
      },
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Custom tenant seed failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});

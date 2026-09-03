import { v7 as uuidV7 } from 'uuid';

import { resolveDatabaseUrl } from '../src/config/schema.ts';
import { PlatformBootstrapService } from '../src/application/services/platform-bootstrap-service.ts';
import { TenantBootstrapService } from '../src/application/services/tenant-bootstrap-service.ts';
import { CoreEnterpriseService } from '../src/application/services/core-enterprise-service.ts';
import { BcryptPasswordHasher } from '../src/infrastructure/security/bcrypt-password-hasher.ts';
import { createDatabasePoolFromUrl } from '../src/infrastructure/database/connection.ts';
import { PostgresPlatformRepository } from '../src/infrastructure/database/repositories/postgres-platform-repository.ts';
import { withTenantContext } from '../src/infrastructure/database/tenant-context.ts';

/**
 * Manual bootstrap/restore for the real deployment test tenant.
 *
 * Creates a controlled multi-organization, multi-branch, multi-location dataset
 * for exercising working-context and authorization flows.
 *
 * IMPORTANT: this is test/deployment data. The three test users intentionally
 * use the shared password requested for the test environment.
 */
async function main() {
  const databaseUrl = resolveDatabaseUrl(process.env);
  const password = 'Password123!';

  const pool = createDatabasePoolFromUrl(databaseUrl);
  const passwordHasher = new BcryptPasswordHasher();
  const repository = new PostgresPlatformRepository(pool);
  const platformBootstrap = new PlatformBootstrapService(repository);
  const tenantBootstrap = new TenantBootstrapService(repository, passwordHasher);
  const coreEnterprise = new CoreEnterpriseService(repository);

  const tenantId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1001';
  const organizationId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1002';
  const branchId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1003';
  const administratorId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1004';
  const administratorRoleId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1005';

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
      name: 'Magod Fusion Technologies Pvt. Ltd.',
      email: 'administrator@magodfusion.in',
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
      state: 'Maharashtra',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    },
    administrator: {
      id: administratorId,
      username: 'administrator',
      email: 'administrator@magodfusion.in',
      password,
      organizationId,
      defaultBranchId: branchId,
    },
    role: {
      id: administratorRoleId,
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

    const existingTenant = await pool.query('SELECT id FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);

    if (existingTenant.rows.length === 0) {
      console.log(`Bootstrapping tenant: ${provider.tenant.name}`);
      await tenantBootstrap.bootstrapTenant(provider);
    } else {
      console.log(`Tenant already exists: ${provider.tenant.name}; updating controlled test data.`);
    }

    const primaryOrganization = await repository.getOrganizationById(tenantId, organizationId);
    if (!primaryOrganization) {
      throw new Error(`Primary organization ${organizationId} is missing after bootstrap.`);
    }
    await coreEnterprise.updateOrganization(tenantId, organizationId, {
      name: 'Magod Fusion Technologies Pvt. Ltd.',
      code: 'MAGOD',
      email: 'administrator@magodfusion.in',
      baseCurrency: 'INR',
      fiscalCalendar: 'standard',
      status: 'active',
      isDefault: true,
    });

    const primaryBranches = await repository.listBranches(tenantId, organizationId);
    let magodPune = primaryBranches.find((branch) => branch.id === branchId) ?? primaryBranches.find((branch) => branch.name === 'Pune');
    if (!magodPune) {
      magodPune = await coreEnterprise.createBranch(tenantId, organizationId, {
        id: undefined,
        code: 'PUNE',
        name: 'Pune',
        status: 'active',
        isHeadOffice: true,
        isDefault: true,
        city: 'Pune',
        state: 'Maharashtra',
        country: 'IN',
        timezone: 'Asia/Kolkata',
      });
    } else {
      magodPune = await coreEnterprise.updateBranch(tenantId, organizationId, magodPune.id, {
        code: 'PUNE',
        name: 'Pune',
        status: 'active',
        isHeadOffice: true,
        isDefault: true,
        city: 'Pune',
        state: 'Maharashtra',
        country: 'IN',
        timezone: 'Asia/Kolkata',
      }) ?? magodPune;
    }

    let magodCSN = primaryBranches.find((branch) => branch.name === 'Chatrapati Sambhaji Nagar (CSN)');
    if (!magodCSN) {
      const legacy = primaryBranches.find((branch) => branch.name === 'Chatrapati Sambhaji Nagar');
      magodCSN = legacy
        ? await coreEnterprise.updateBranch(tenantId, organizationId, legacy.id, {
            name: 'Chatrapati Sambhaji Nagar (CSN)',
            status: 'active',
            isHeadOffice: false,
            isDefault: false,
            city: 'Chhatrapati Sambhajinagar',
            district: 'Chhatrapati Sambhajinagar',
            state: 'Maharashtra',
            country: 'IN',
            timezone: 'Asia/Kolkata',
          })
        : await coreEnterprise.createBranch(tenantId, organizationId, {
            name: 'Chatrapati Sambhaji Nagar (CSN)',
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

    if (!magodCSN) {
      throw new Error('Failed to create/resolve Magod Fusion CSN branch.');
    }

    const organizations = await repository.listOrganizations(tenantId);
    let trimill = organizations.find((organization) => organization.name === 'Trimill Industries Pvt. Ltd.' && !organization.isDeleted);
    if (!trimill) {
      const legacy = organizations.find((organization) => organization.name === 'Magod Fusion Manufacturing' && !organization.isDeleted);
      trimill = legacy
        ? await coreEnterprise.updateOrganization(tenantId, legacy.id, {
            code: 'TRIMILL',
            name: 'Trimill Industries Pvt. Ltd.',
            email: 'admin@trimill.in',
            baseCurrency: 'INR',
            fiscalCalendar: 'standard',
            status: 'active',
            isDefault: false,
            remarks: 'Controlled working-context test organization.',
          })
        : await coreEnterprise.createOrganization(tenantId, {
            code: 'TRIMILL',
            name: 'Trimill Industries Pvt. Ltd.',
            email: 'admin@trimill.in',
            baseCurrency: 'INR',
            fiscalCalendar: 'standard',
            status: 'active',
            isDefault: false,
            remarks: 'Controlled working-context test organization.',
          });
    }

    if (!trimill) {
      throw new Error('Failed to create/resolve Trimill Industries organization.');
    }

    const trimillBranches = await repository.listBranches(tenantId, trimill.id);
    let trimillPune = trimillBranches.find((branch) => branch.name === 'Pune');
    if (!trimillPune) {
      const legacy = trimillBranches.find((branch) => branch.name === 'Pune Manufacturing');
      trimillPune = legacy
        ? await coreEnterprise.updateBranch(tenantId, trimill.id, legacy.id, {
            name: 'Pune',
            status: 'active',
            isHeadOffice: true,
            isDefault: true,
            city: 'Pune',
            state: 'Maharashtra',
            country: 'IN',
            timezone: 'Asia/Kolkata',
          })
        : await coreEnterprise.createBranch(tenantId, trimill.id, {
            name: 'Pune',
            status: 'active',
            isHeadOffice: true,
            isDefault: true,
            city: 'Pune',
            state: 'Maharashtra',
            country: 'IN',
            timezone: 'Asia/Kolkata',
          });
    }

    let trimillIndapur = trimillBranches.find((branch) => branch.name === 'Indapur');
    if (!trimillIndapur) {
      const legacy = trimillBranches.find((branch) => branch.name === 'Mumbai Manufacturing');
      trimillIndapur = legacy
        ? await coreEnterprise.updateBranch(tenantId, trimill.id, legacy.id, {
            name: 'Indapur',
            status: 'active',
            isHeadOffice: false,
            isDefault: false,
            city: 'Indapur',
            district: 'Pune',
            state: 'Maharashtra',
            country: 'IN',
            timezone: 'Asia/Kolkata',
          })
        : await coreEnterprise.createBranch(tenantId, trimill.id, {
            name: 'Indapur',
            status: 'active',
            isHeadOffice: false,
            isDefault: false,
            city: 'Indapur',
            district: 'Pune',
            state: 'Maharashtra',
            country: 'IN',
            timezone: 'Asia/Kolkata',
          });
    }

    if (!trimillPune || !trimillIndapur) {
      throw new Error('Failed to create/resolve Trimill branches.');
    }

    async function ensureLocation(organizationIdForLocation: string, desiredName: string, legacyNames: string[], city: string, isDefault: boolean) {
      const locations = await repository.listLocations(tenantId, organizationIdForLocation);
      const existing = locations.find((location) => location.name === desiredName && !location.isDeleted);
      if (existing) {
        return existing;
      }

      const legacy = locations.find((location) => legacyNames.includes(location.name) && !location.isDeleted);
      if (legacy) {
        return await repository.updateLocation(tenantId, organizationIdForLocation, legacy.id, {
          name: desiredName,
          status: 'active',
          isDefault,
          city,
          state: 'Maharashtra',
          country: 'IN',
          timezone: 'Asia/Kolkata',
        }) ?? legacy;
      }

      const currentLocations = await repository.listLocations(tenantId, organizationIdForLocation);
      const hasDefault = currentLocations.some((location) => location.isDefault && !location.isDeleted);
      const code = await repository.generateLocationCode(tenantId, organizationIdForLocation);
      return repository.createLocation(tenantId, organizationIdForLocation, {
        code,
        name: desiredName,
        status: 'active',
        isDefault: isDefault && !hasDefault,
        city,
        state: 'Maharashtra',
        country: 'IN',
        timezone: 'Asia/Kolkata',
      });
    }

    const magodPuneLocation = await ensureLocation(organizationId, 'Pune Manufacturing', ['Pune Plant'], 'Pune', true);
    const magodCSNLocation = await ensureLocation(organizationId, 'CSN Manufacturing', ['Chatrapati Sambhaji Nagar Plant'], 'Chhatrapati Sambhajinagar', false);
    const trimillPuneLocation = await ensureLocation(trimill.id, 'Pune Manufacturing', ['Pune Manufacturing Plant'], 'Pune', true);
    const trimillIndapurLocation = await ensureLocation(trimill.id, 'Indapur Manufacturing', ['Mumbai Manufacturing Plant'], 'Indapur', false);

    const tenantAdminRole = await repository.findRoleByTenantAndCode(tenantId, 'tenant-admin');
    if (!tenantAdminRole) {
      throw new Error('Tenant Administrator role is missing after bootstrap.');
    }

    let managerRole = await repository.findRoleByTenantAndCode(tenantId, 'manager');
    if (!managerRole) {
      managerRole = await repository.createRole(tenantId, 'manager', 'Manager');
    }

    const allPermissions = await repository.listPermissions(tenantId);
    const managerPermissions = allPermissions
      .filter((permission) => permission.action === 'read')
      .map((permission) => permission.permissionKey);
    await repository.replacePermissionsForRole(tenantId, managerRole.id, managerPermissions);

    const administrator = await repository.findById(tenantId, administratorId);
    const legacyAdmin = await repository.findByTenantAndIdentifier(tenantId, 'admin');

    let administratorUser = administrator;
    if (!administratorUser) {
      if (!legacyAdmin) {
        throw new Error(`Expected bootstrap administrator ${administratorId} was not found.`);
      }
      administratorUser = await coreEnterprise.updateUser(tenantId, legacyAdmin.id, {
        username: 'administrator',
        email: 'administrator@magodfusion.in',
        organizationId,
        defaultBranchId: magodPune.id,
        defaultLocationId: magodPuneLocation.id,
        status: 'active',
      });
    } else {
      administratorUser = await coreEnterprise.updateUser(tenantId, administratorUser.id, {
        username: 'administrator',
        email: 'administrator@magodfusion.in',
        organizationId,
        defaultBranchId: magodPune.id,
        defaultLocationId: magodPuneLocation.id,
        status: 'active',
      });
    }

    if (!administratorUser) {
      throw new Error('Failed to ensure administrator user.');
    }

    async function ensureUser(username: string, email: string, organizationIdForUser: string, defaultBranchId: string, defaultLocationId: string) {
      let user = await repository.findByTenantAndIdentifier(tenantId, username);
      const passwordHash = await passwordHasher.hash(password);

      if (!user) {
        user = await repository.createUser({
          id: uuidV7(),
          tenantId,
          organizationId: organizationIdForUser,
          defaultBranchId,
          defaultLocationId,
          username,
          email,
          passwordHash,
          status: 'active',
        });
      } else {
        const updated = await coreEnterprise.updateUser(tenantId, user.id, {
          username,
          email,
          organizationId: organizationIdForUser,
          defaultBranchId,
          defaultLocationId,
          status: 'active',
        });
        if (!updated) {
          throw new Error(`Failed to update user ${username}.`);
        }
        user = updated;
      }

      await withTenantContext(pool, 'app.current_tenant_id', tenantId, async (client) => {
        await client.query(
          'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE tenant_id = $2 AND id = $3',
          [passwordHash, tenantId, user.id],
        );
      });

      return user;
    }

    const admin = await ensureUser('admin', 'admin@magodfusion.in', organizationId, magodPune.id, magodPuneLocation.id);
    const manager = await ensureUser('manager', 'manager@magodfusion.in', organizationId, magodPune.id, magodPuneLocation.id);

    await withTenantContext(pool, 'app.current_tenant_id', tenantId, async (client) => {
      for (const user of [administratorUser!, admin]) {
        await client.query('DELETE FROM user_organization_access WHERE tenant_id = $1 AND user_id = $2', [tenantId, user.id]);
        await client.query('DELETE FROM user_branch_access WHERE tenant_id = $1 AND user_id = $2', [tenantId, user.id]);
        await client.query('DELETE FROM user_location_access WHERE tenant_id = $1 AND user_id = $2', [tenantId, user.id]);
        await client.query('DELETE FROM user_roles WHERE tenant_id = $1 AND user_id = $2', [tenantId, user.id]);
      }
      await client.query('DELETE FROM user_organization_access WHERE tenant_id = $1 AND user_id = $2', [tenantId, manager.id]);
      await client.query('DELETE FROM user_branch_access WHERE tenant_id = $1 AND user_id = $2', [tenantId, manager.id]);
      await client.query('DELETE FROM user_location_access WHERE tenant_id = $1 AND user_id = $2', [tenantId, manager.id]);
      await client.query('DELETE FROM user_roles WHERE tenant_id = $1 AND user_id = $2', [tenantId, manager.id]);
    });

    const allOrgIds = [organizationId, trimill.id];
    const allBranchIds = [magodPune.id, magodCSN.id, trimillPune.id, trimillIndapur.id];
    const allLocations = [
      [organizationId, magodPuneLocation.id],
      [organizationId, magodCSNLocation.id],
      [trimill.id, trimillPuneLocation.id],
      [trimill.id, trimillIndapurLocation.id],
    ] as const;

    for (const user of [administratorUser, admin]) {
      for (const organizationIdForUser of allOrgIds) {
        if (!(await coreEnterprise.assignUserToOrganization(tenantId, user.id, organizationIdForUser))) {
          throw new Error(`Failed to assign ${user.username} to organization ${organizationIdForUser}.`);
        }
      }
      for (const branchIdForUser of allBranchIds) {
        if (!(await coreEnterprise.assignUserToBranch(tenantId, user.id, branchIdForUser))) {
          throw new Error(`Failed to assign ${user.username} to branch ${branchIdForUser}.`);
        }
      }
      await withTenantContext(pool, 'app.current_tenant_id', tenantId, async (client) => {
        for (const [locationOrganizationId, locationId] of allLocations) {
          await client.query(
            `INSERT INTO user_location_access (tenant_id, user_id, organization_id, location_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, location_id, tenant_id) DO NOTHING`,
            [tenantId, user.id, locationOrganizationId, locationId],
          );
        }
      });
      if (!(await repository.assignRoleToUser(tenantId, user.id, tenantAdminRole.id))) {
        throw new Error(`Failed to assign Tenant Administrator role to ${user.username}.`);
      }
    }

    if (!(await coreEnterprise.assignUserToOrganization(tenantId, manager.id, organizationId))) {
      throw new Error('Failed to assign manager to Magod Fusion organization.');
    }
    for (const branch of [magodPune, magodCSN]) {
      if (!(await coreEnterprise.assignUserToBranch(tenantId, manager.id, branch.id))) {
        throw new Error(`Failed to assign manager to branch ${branch.name}.`);
      }
    }
    await withTenantContext(pool, 'app.current_tenant_id', tenantId, async (client) => {
      for (const location of [magodPuneLocation, magodCSNLocation]) {
        await client.query(
          `INSERT INTO user_location_access (tenant_id, user_id, organization_id, location_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, location_id, tenant_id) DO NOTHING`,
          [tenantId, manager.id, organizationId, location.id],
        );
      }
    });
    if (!(await repository.assignRoleToUser(tenantId, manager.id, managerRole.id))) {
      throw new Error('Failed to assign Manager role.');
    }

    const administratorOrganizations = await repository.findUserOrganizationMemberships(tenantId, administratorUser.id);
    const adminOrganizations = await repository.findUserOrganizationMemberships(tenantId, admin.id);
    const managerOrganizations = await repository.findUserOrganizationMemberships(tenantId, manager.id);
    const administratorBranches = allBranchIds.length === (await Promise.all(allOrgIds.map((id) => repository.listAccessibleBranchesForUser(tenantId, administratorUser.id, id)))).flat().length;
    const adminBranches = allBranchIds.length === (await Promise.all(allOrgIds.map((id) => repository.listAccessibleBranchesForUser(tenantId, admin.id, id)))).flat().length;
    const managerBranches = (await repository.listAccessibleBranchesForUser(tenantId, manager.id, organizationId)).length;
    const managerTrimillBranches = (await repository.listAccessibleBranchesForUser(tenantId, manager.id, trimill.id)).length;
    const managerLocations = (await repository.listAccessibleLocationsForUser(tenantId, manager.id, organizationId)).length;
    const managerTrimillLocations = (await repository.listAccessibleLocationsForUser(tenantId, manager.id, trimill.id)).length;

    if (administratorOrganizations.length !== 2 || adminOrganizations.length !== 2) {
      throw new Error('Seed validation failed: Administrator and Admin must have both organizations.');
    }
    if (!administratorBranches || !adminBranches) {
      throw new Error('Seed validation failed: Administrator and Admin must have all four branches.');
    }
    if (managerOrganizations.length !== 1 || managerOrganizations[0].id !== organizationId) {
      throw new Error('Seed validation failed: Manager must have only Magod Fusion organization access.');
    }
    if (managerBranches !== 2 || managerTrimillBranches !== 0 || managerLocations !== 2 || managerTrimillLocations !== 0) {
      throw new Error('Seed validation failed: Manager must have only Magod Fusion branches and locations.');
    }

    console.log(JSON.stringify({
      tenant: provider.tenant,
      organizations: [
        {
          name: 'Magod Fusion Technologies Pvt. Ltd.',
          branches: [
            { name: 'Pune', location: 'Pune Manufacturing' },
            { name: 'Chatrapati Sambhaji Nagar (CSN)', location: 'CSN Manufacturing' },
          ],
        },
        {
          name: 'Trimill Industries Pvt. Ltd.',
          branches: [
            { name: 'Pune', location: 'Pune Manufacturing' },
            { name: 'Indapur', location: 'Indapur Manufacturing' },
          ],
        },
      ],
      users: [
        { username: 'administrator', role: 'Administrator', access: 'Both organizations / all 4 branches / all 4 locations' },
        { username: 'admin', role: 'Admin', access: 'Both organizations / all 4 branches / all 4 locations' },
        { username: 'manager', role: 'Manager', access: 'Magod Fusion only / 2 branches / 2 locations' },
      ],
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

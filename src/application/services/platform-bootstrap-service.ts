import type { PlatformBootstrapRepository } from '../../domain/contracts/repositories.js';
import type {
  PlatformModuleSeed,
  PlatformPermissionSeed,
  PlatformSubscriptionPlanSeed,
} from '../../domain/contracts/bootstrap.js';
import type { ReferenceDataSummary } from '../contracts/security.js';

const DEFAULT_SUBSCRIPTION_PLANS: PlatformSubscriptionPlanSeed[] = [
  {
    name: 'Starter',
    description: 'For small teams and initial deployments.',
    priceMonthly: 29,
    maxUsers: 25,
    maxStorageGb: 50,
    isActive: true,
  },
  {
    name: 'Growth',
    description: 'For growing organizations with shared operations.',
    priceMonthly: 79,
    maxUsers: 200,
    maxStorageGb: 250,
    isActive: true,
  },
  {
    name: 'Enterprise',
    description: 'For large enterprises with full platform coverage.',
    priceMonthly: 199,
    maxUsers: null,
    maxStorageGb: null,
    isActive: true,
  },
];

const DEFAULT_MODULES: PlatformModuleSeed[] = [
  { code: 'core', name: 'Core Platform', moduleGroup: 'Administration', isCore: true, sortOrder: 1 },
  { code: 'security', name: 'Security', moduleGroup: 'Administration', isCore: true, sortOrder: 2 },
  { code: 'organization', name: 'Organizations', moduleGroup: 'Administration', isCore: true, sortOrder: 3 },
  { code: 'branch', name: 'Branches', moduleGroup: 'Administration', isCore: true, sortOrder: 4 },
  { code: 'user-management', name: 'User Management', moduleGroup: 'Administration', isCore: true, sortOrder: 5 },
  {
    code: 'tenant-configuration',
    name: 'Tenant Configuration',
    moduleGroup: 'Administration',
    isCore: true,
    sortOrder: 6,
  },
];

const DEFAULT_PERMISSIONS: PlatformPermissionSeed[] = [
  {
    moduleCode: 'tenant-configuration',
    resource: 'tenant',
    action: 'read',
    scope: 'tenant',
    permissionKey: 'tenant.read',
    displayName: 'View tenant details',
  },
  {
    moduleCode: 'tenant-configuration',
    resource: 'tenant',
    action: 'manage',
    scope: 'tenant',
    permissionKey: 'tenant.manage',
    displayName: 'Manage tenant configuration',
  },
  {
    moduleCode: 'organization',
    resource: 'organization',
    action: 'read',
    scope: 'organization',
    permissionKey: 'organization.read',
    displayName: 'View organizations',
  },
  {
    moduleCode: 'organization',
    resource: 'organization',
    action: 'manage',
    scope: 'organization',
    permissionKey: 'organization.manage',
    displayName: 'Manage organizations',
  },
  {
    moduleCode: 'branch',
    resource: 'branch',
    action: 'read',
    scope: 'branch',
    permissionKey: 'branch.read',
    displayName: 'View branches',
  },
  {
    moduleCode: 'branch',
    resource: 'branch',
    action: 'manage',
    scope: 'branch',
    permissionKey: 'branch.manage',
    displayName: 'Manage branches',
  },
  {
    moduleCode: 'user-management',
    resource: 'user',
    action: 'read',
    scope: 'organization',
    permissionKey: 'user.read',
    displayName: 'View users',
  },
  {
    moduleCode: 'user-management',
    resource: 'user',
    action: 'manage',
    scope: 'organization',
    permissionKey: 'user.manage',
    displayName: 'Manage users',
  },
  {
    moduleCode: 'security',
    resource: 'role',
    action: 'read',
    scope: 'tenant',
    permissionKey: 'role.read',
    displayName: 'View roles',
  },
  {
    moduleCode: 'security',
    resource: 'role',
    action: 'manage',
    scope: 'tenant',
    permissionKey: 'role.manage',
    displayName: 'Manage roles',
  },
  {
    moduleCode: 'security',
    resource: 'permission',
    action: 'read',
    scope: 'tenant',
    permissionKey: 'permission.read',
    displayName: 'View permissions',
  },
  {
    moduleCode: 'security',
    resource: 'permission',
    action: 'manage',
    scope: 'tenant',
    permissionKey: 'permission.manage',
    displayName: 'Manage permissions',
  },
  {
    moduleCode: 'security',
    resource: 'session',
    action: 'manage',
    scope: 'tenant',
    permissionKey: 'session.manage',
    displayName: 'Manage sessions',
  },
];

export class PlatformBootstrapService {
  constructor(private readonly repository: PlatformBootstrapRepository) {}

  async seedReferenceData(): Promise<ReferenceDataSummary> {
    await this.repository.seedSubscriptionPlans(DEFAULT_SUBSCRIPTION_PLANS);
    await this.repository.seedModules(DEFAULT_MODULES);
    await this.repository.seedPermissions(DEFAULT_PERMISSIONS);

    return {
      subscriptionPlans: DEFAULT_SUBSCRIPTION_PLANS.length,
      modules: DEFAULT_MODULES.length,
      permissions: DEFAULT_PERMISSIONS.length,
    };
  }
}

export const DEFAULT_PLATFORM_SEED = {
  subscriptionPlans: DEFAULT_SUBSCRIPTION_PLANS,
  modules: DEFAULT_MODULES,
  permissions: DEFAULT_PERMISSIONS,
};

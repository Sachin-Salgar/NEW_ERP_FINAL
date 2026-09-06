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
  { code: 'tenant-configuration', name: 'Tenant Configuration', moduleGroup: 'Administration', isCore: true, sortOrder: 6 },
  { code: 'crm', name: 'Customer Relationship Management', moduleGroup: 'CRM', isCore: false, sortOrder: 20 },
  { code: 'inventory', name: 'Inventory and Item Master', moduleGroup: 'Inventory', isCore: false, sortOrder: 40 },
  { code: 'sales', name: 'Sales', moduleGroup: 'Sales', isCore: false, sortOrder: 30 },
  { code: 'purchase', name: 'Procurement', moduleGroup: 'Procurement', isCore: false, sortOrder: 35 },
];

const DEFAULT_PERMISSIONS: PlatformPermissionSeed[] = [
  { moduleCode: 'tenant-configuration', resource: 'tenant', action: 'read', scope: 'tenant', permissionKey: 'tenant.read', displayName: 'View tenant details' },
  { moduleCode: 'tenant-configuration', resource: 'tenant', action: 'create', scope: 'global', permissionKey: 'tenant.create', displayName: 'Create tenants' },
  { moduleCode: 'tenant-configuration', resource: 'tenant', action: 'update', scope: 'tenant', permissionKey: 'tenant.update', displayName: 'Update tenants' },
  { moduleCode: 'tenant-configuration', resource: 'tenant', action: 'delete', scope: 'global', permissionKey: 'tenant.delete', displayName: 'Delete tenants' },
  { moduleCode: 'tenant-configuration', resource: 'tenant', action: 'activate', scope: 'global', permissionKey: 'tenant.activate', displayName: 'Activate tenants' },
  { moduleCode: 'tenant-configuration', resource: 'tenant', action: 'deactivate', scope: 'global', permissionKey: 'tenant.deactivate', displayName: 'Deactivate tenants' },
  { moduleCode: 'tenant-configuration', resource: 'tenant', action: 'suspend', scope: 'global', permissionKey: 'tenant.suspend', displayName: 'Suspend tenants' },
  { moduleCode: 'tenant-configuration', resource: 'tenant', action: 'reactivate', scope: 'global', permissionKey: 'tenant.reactivate', displayName: 'Reactivate tenants' },
  { moduleCode: 'tenant-configuration', resource: 'tenant.member', action: 'read', scope: 'tenant', permissionKey: 'tenant.member.read', displayName: 'View tenant members' },
  { moduleCode: 'tenant-configuration', resource: 'tenant.member', action: 'create', scope: 'tenant', permissionKey: 'tenant.member.create', displayName: 'Add tenant members' },
  { moduleCode: 'tenant-configuration', resource: 'tenant.member', action: 'update', scope: 'tenant', permissionKey: 'tenant.member.update', displayName: 'Update tenant members' },
  { moduleCode: 'tenant-configuration', resource: 'tenant.member', action: 'delete', scope: 'tenant', permissionKey: 'tenant.member.delete', displayName: 'Remove tenant members' },
  { moduleCode: 'tenant-configuration', resource: 'tenant.member', action: 'activate', scope: 'tenant', permissionKey: 'tenant.member.activate', displayName: 'Activate tenant members' },
  { moduleCode: 'tenant-configuration', resource: 'tenant.member', action: 'deactivate', scope: 'tenant', permissionKey: 'tenant.member.deactivate', displayName: 'Deactivate tenant members' },
  { moduleCode: 'tenant-configuration', resource: 'tenant.access', action: 'read', scope: 'tenant', permissionKey: 'tenant.access.read', displayName: 'View tenant access' },
  { moduleCode: 'tenant-configuration', resource: 'tenant.access', action: 'grant', scope: 'tenant', permissionKey: 'tenant.access.grant', displayName: 'Grant tenant access' },
  { moduleCode: 'tenant-configuration', resource: 'tenant.access', action: 'revoke', scope: 'tenant', permissionKey: 'tenant.access.revoke', displayName: 'Revoke tenant access' },
  { moduleCode: 'organization', resource: 'organization', action: 'read', scope: 'organization', permissionKey: 'organization.read', displayName: 'View organizations' },
  { moduleCode: 'organization', resource: 'organization', action: 'create', scope: 'organization', permissionKey: 'organization.create', displayName: 'Create organizations' },
  { moduleCode: 'organization', resource: 'organization', action: 'update', scope: 'organization', permissionKey: 'organization.update', displayName: 'Update organizations' },
  { moduleCode: 'organization', resource: 'organization', action: 'deactivate', scope: 'organization', permissionKey: 'organization.deactivate', displayName: 'Deactivate organizations' },
  { moduleCode: 'organization', resource: 'organization', action: 'activate', scope: 'organization', permissionKey: 'organization.activate', displayName: 'Activate organizations' },
  { moduleCode: 'organization', resource: 'organization', action: 'delete', scope: 'organization', permissionKey: 'organization.delete', displayName: 'Delete organizations' },
  { moduleCode: 'organization', resource: 'location', action: 'read', scope: 'organization', permissionKey: 'organization.location.read', displayName: 'View locations' },
  { moduleCode: 'organization', resource: 'location', action: 'create', scope: 'organization', permissionKey: 'organization.location.create', displayName: 'Create locations' },
  { moduleCode: 'organization', resource: 'location', action: 'update', scope: 'organization', permissionKey: 'organization.location.update', displayName: 'Update locations' },
  { moduleCode: 'organization', resource: 'location', action: 'deactivate', scope: 'organization', permissionKey: 'organization.location.deactivate', displayName: 'Deactivate locations' },
  { moduleCode: 'organization', resource: 'location', action: 'activate', scope: 'organization', permissionKey: 'organization.location.activate', displayName: 'Activate locations' },
  { moduleCode: 'organization', resource: 'location', action: 'delete', scope: 'organization', permissionKey: 'organization.location.delete', displayName: 'Delete locations' },
  { moduleCode: 'branch', resource: 'branch', action: 'read', scope: 'branch', permissionKey: 'branch.read', displayName: 'View branches' },
  { moduleCode: 'branch', resource: 'branch', action: 'create', scope: 'branch', permissionKey: 'branch.create', displayName: 'Create branches' },
  { moduleCode: 'branch', resource: 'branch', action: 'update', scope: 'branch', permissionKey: 'branch.update', displayName: 'Update branches' },
  { moduleCode: 'branch', resource: 'branch', action: 'deactivate', scope: 'branch', permissionKey: 'branch.deactivate', displayName: 'Deactivate branches' },
  { moduleCode: 'branch', resource: 'branch', action: 'activate', scope: 'branch', permissionKey: 'branch.activate', displayName: 'Activate branches' },
  { moduleCode: 'branch', resource: 'branch', action: 'delete', scope: 'branch', permissionKey: 'branch.delete', displayName: 'Delete branches' },
  { moduleCode: 'user-management', resource: 'user', action: 'read', scope: 'organization', permissionKey: 'user.read', displayName: 'View users' },
  { moduleCode: 'user-management', resource: 'user', action: 'create', scope: 'organization', permissionKey: 'user.create', displayName: 'Create users' },
  { moduleCode: 'user-management', resource: 'user', action: 'update', scope: 'organization', permissionKey: 'user.update', displayName: 'Update users' },
  { moduleCode: 'user-management', resource: 'user', action: 'activate', scope: 'organization', permissionKey: 'user.activate', displayName: 'Activate users' },
  { moduleCode: 'user-management', resource: 'user', action: 'deactivate', scope: 'organization', permissionKey: 'user.deactivate', displayName: 'Deactivate users' },
  { moduleCode: 'security', resource: 'role', action: 'read', scope: 'tenant', permissionKey: 'role.read', displayName: 'View roles' },
  { moduleCode: 'security', resource: 'role', action: 'create', scope: 'tenant', permissionKey: 'role.create', displayName: 'Create roles' },
  { moduleCode: 'security', resource: 'role', action: 'update', scope: 'tenant', permissionKey: 'role.update', displayName: 'Update roles' },
  { moduleCode: 'security', resource: 'role', action: 'delete', scope: 'tenant', permissionKey: 'role.delete', displayName: 'Delete roles' },
  { moduleCode: 'security', resource: 'role', action: 'activate', scope: 'tenant', permissionKey: 'role.activate', displayName: 'Activate roles' },
  { moduleCode: 'security', resource: 'role', action: 'deactivate', scope: 'tenant', permissionKey: 'role.deactivate', displayName: 'Deactivate roles' },
  { moduleCode: 'security', resource: 'role_permission', action: 'read', scope: 'tenant', permissionKey: 'role_permission.read', displayName: 'View role permissions' },
  { moduleCode: 'security', resource: 'role_permission', action: 'grant', scope: 'tenant', permissionKey: 'role_permission.grant', displayName: 'Grant role permissions' },
  { moduleCode: 'security', resource: 'role_permission', action: 'revoke', scope: 'tenant', permissionKey: 'role_permission.revoke', displayName: 'Revoke role permissions' },
  { moduleCode: 'security', resource: 'permission', action: 'read', scope: 'tenant', permissionKey: 'permission.read', displayName: 'View permissions' },
  { moduleCode: 'security', resource: 'session', action: 'read', scope: 'tenant', permissionKey: 'security.session.read', displayName: 'View sessions' },
  { moduleCode: 'security', resource: 'session', action: 'revoke', scope: 'tenant', permissionKey: 'security.session.revoke', displayName: 'Revoke sessions' },
  { moduleCode: 'security', resource: 'session', action: 'revoke_all', scope: 'tenant', permissionKey: 'security.session.revoke_all', displayName: 'Revoke all user sessions' },
  { moduleCode: 'security', resource: 'audit_log', action: 'read', scope: 'tenant', permissionKey: 'security.audit_log.read', displayName: 'View audit logs' },
  { moduleCode: 'security', resource: 'audit_log', action: 'export', scope: 'tenant', permissionKey: 'security.audit_log.export', displayName: 'Export audit logs' },
  { moduleCode: 'security', resource: 'policy', action: 'read', scope: 'tenant', permissionKey: 'security.policy.read', displayName: 'View security policy' },
  { moduleCode: 'security', resource: 'policy', action: 'update', scope: 'tenant', permissionKey: 'security.policy.update', displayName: 'Update security policy' },
  { moduleCode: 'crm', resource: 'customer', action: 'read', scope: 'organization', permissionKey: 'customer.read', displayName: 'View customers' },
  { moduleCode: 'crm', resource: 'customer', action: 'create', scope: 'organization', permissionKey: 'customer.create', displayName: 'Create customers' },
  { moduleCode: 'crm', resource: 'customer', action: 'update', scope: 'organization', permissionKey: 'customer.update', displayName: 'Update customers' },
  { moduleCode: 'crm', resource: 'customer', action: 'delete', scope: 'organization', permissionKey: 'customer.delete', displayName: 'Delete customers' },
  ...(['read', 'create', 'update', 'delete'] as const).map((action) => ({ moduleCode: 'inventory', resource: 'item', action, scope: 'organization' as const, permissionKey: `inventory.item.${action}`, displayName: `${action[0].toUpperCase()}${action.slice(1)} item master records` })),
  ...([['warehouse', 'read'], ['warehouse', 'create'], ['warehouse', 'update'], ['stock', 'read'], ['stock', 'receive'], ['stock', 'return'], ['reservation', 'read'], ['reservation', 'create'], ['reservation', 'release'], ['reservation', 'fulfill']] as const).map(([resource, action]) => ({ moduleCode: 'inventory', resource, action, scope: 'organization' as const, permissionKey: `inventory.${resource}.${action}`, displayName: `${action[0].toUpperCase()}${action.slice(1)} inventory ${resource} records` })),
  ...(['read', 'create', 'update', 'delete', 'send', 'accept', 'reject', 'expire', 'cancel'] as const).map((action) => ({ moduleCode: 'sales', resource: 'quotation', action, scope: 'organization' as const, permissionKey: `sales.quotation.${action}`, displayName: `${action[0].toUpperCase()}${action.slice(1)} quotations` })),
  ...([['supplier', 'read'], ['supplier', 'create'], ['supplier', 'update'], ['supplier', 'delete'], ['requisition', 'read'], ['requisition', 'create'], ['requisition', 'update'], ['requisition', 'submit'], ['requisition', 'approve'], ['requisition', 'reject'], ['requisition', 'cancel'], ['requisition', 'workflow'], ['order', 'read'], ['order', 'create'], ['order', 'update'], ['order', 'submit'], ['order', 'approve'], ['order', 'reject'], ['order', 'cancel'], ['order', 'workflow'], ['receipt', 'read'], ['receipt', 'create'], ['receipt', 'update'], ['receipt', 'complete'], ['receipt', 'cancel'], ['receipt', 'workflow']] as const).map(([resource, action]) => ({ moduleCode: 'purchase', resource, action, scope: 'organization' as const, permissionKey: `purchase.${resource}.${action}`, displayName: `${action[0].toUpperCase()}${action.slice(1)} procurement ${resource.replace('_', ' ')} records` })),
  ...(['read', 'create', 'update', 'delete', 'confirm', 'reserve', 'cancel', 'close'] as const).map((action) => ({ moduleCode: 'sales', resource: 'order', action, scope: 'organization' as const, permissionKey: `sales.order.${action}`, displayName: `${action[0].toUpperCase()}${action.slice(1)} orders` })),
  ...(['read', 'create', 'update', 'dispatch', 'deliver', 'complete', 'cancel'] as const).map((action) => ({ moduleCode: 'sales', resource: 'delivery', action, scope: 'organization' as const, permissionKey: `sales.delivery.${action}`, displayName: `${action[0].toUpperCase()}${action.slice(1)} deliveries` })),
  ...(['read', 'create', 'update', 'issue', 'cancel'] as const).map((action) => ({ moduleCode: 'sales', resource: 'invoice', action, scope: 'organization' as const, permissionKey: `sales.invoice.${action}`, displayName: `${action[0].toUpperCase()}${action.slice(1)} invoices` })),
  ...(['read', 'create', 'update', 'inspect', 'approve', 'reject', 'process', 'cancel', 'close'] as const).map((action) => ({ moduleCode: 'sales', resource: 'return', action, scope: 'organization' as const, permissionKey: `sales.return.${action}`, displayName: `${action[0].toUpperCase()}${action.slice(1)} returns` })),
  ...(['read', 'create', 'update', 'issue', 'cancel'] as const).map((action) => ({ moduleCode: 'sales', resource: 'credit_note', action, scope: 'organization' as const, permissionKey: `sales.credit_note.${action}`, displayName: `${action[0].toUpperCase()}${action.slice(1)} credit notes` })),
  ...(['read', 'create', 'update', 'publish', 'archive'] as const).map((action) => ({ moduleCode: 'sales', resource: 'pricing', action, scope: 'organization' as const, permissionKey: `sales.pricing.${action}`, displayName: `${action[0].toUpperCase()}${action.slice(1)} price lists` })),
  ...(['read', 'create', 'update', 'activate', 'deactivate'] as const).map((action) => ({ moduleCode: 'sales', resource: 'tax_configuration', action, scope: 'organization' as const, permissionKey: `tax.configuration.${action}`, displayName: `${action[0].toUpperCase()}${action.slice(1)} tax configuration` })),
  ...(['read', 'create', 'update', 'publish', 'archive'] as const).map((action) => ({ moduleCode: 'sales', resource: 'discount', action, scope: 'organization' as const, permissionKey: `sales.discount.${action}`, displayName: `${action[0].toUpperCase()}${action.slice(1)} discount rules` })),
  { moduleCode: 'sales', resource: 'reporting', action: 'read', scope: 'organization' as const, permissionKey: 'sales.reporting.read', displayName: 'Read Sales reports' },
];

export class PlatformBootstrapService {
  constructor(private readonly repository: PlatformBootstrapRepository) {}
  async seedReferenceData(): Promise<ReferenceDataSummary> {
    await this.repository.seedSubscriptionPlans(DEFAULT_SUBSCRIPTION_PLANS);
    await this.repository.seedModules(DEFAULT_MODULES);
    await this.repository.seedPermissions(DEFAULT_PERMISSIONS);
    return { subscriptionPlans: DEFAULT_SUBSCRIPTION_PLANS.length, modules: DEFAULT_MODULES.length, permissions: DEFAULT_PERMISSIONS.length };
  }
}

export const DEFAULT_PLATFORM_SEED = { subscriptionPlans: DEFAULT_SUBSCRIPTION_PLANS, modules: DEFAULT_MODULES, permissions: DEFAULT_PERMISSIONS };

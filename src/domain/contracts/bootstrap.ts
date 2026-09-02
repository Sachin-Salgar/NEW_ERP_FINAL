export interface PlatformSubscriptionPlanSeed {
  name: string;
  description?: string | null;
  priceMonthly: number;
  maxUsers?: number | null;
  maxStorageGb?: number | null;
  isActive?: boolean;
}

export interface PlatformModuleSeed {
  code: string;
  name: string;
  moduleGroup?: string;
  description?: string | null;
  icon?: string | null;
  route?: string | null;
  isCore?: boolean;
  sortOrder?: number;
  parentModuleCode?: string | null;
}

export interface PlatformPermissionSeed {
  moduleCode: string;
  resource: string;
  action: string;
  scope?: 'own' | 'branch' | 'organization' | 'tenant' | 'global';
  permissionKey: string;
  displayName: string;
  description?: string | null;
  isSystem?: boolean;
}

export interface TenantBootstrapInput {
  tenant: {
    id?: string;
    name: string;
    displayName?: string | null;
    subdomain: string;
    slug: string;
    timezone?: string;
    currency?: string;
    locale?: string;
    status?: 'active' | 'suspended' | 'trial' | 'expired' | 'cancelled' | 'maintenance';
  };
  organization: {
    id?: string;
    code?: string;
    name: string;
    legalName?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    baseCurrency?: string;
    fiscalCalendar?: string;
    status?: 'active' | 'inactive' | 'archived';
    isDefault?: boolean;
  };
  branch: {
    id?: string;
    code?: string;
    name: string;
    status?: 'active' | 'inactive' | 'archived';
    isHeadOffice?: boolean;
    isDefault?: boolean;
    city?: string | null;
    country?: string | null;
    timezone?: string;
  };
  administrator: {
    id?: string;
    username: string;
    email: string;
    password: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
  };
  role: {
    id?: string;
    code: string;
    name: string;
    description?: string | null;
    isSystem?: boolean;
  };
  permissions: string[];
  subscriptionPlanName?: string;
  initialFinancialYear?: {
    name: string;
    startDate: string;
    endDate: string;
    status?: 'open' | 'closed' | 'locked';
    isActive?: boolean;
  };
}

export interface TenantBootstrapResult {
  tenantId: string;
  organizationId: string;
  branchId: string;
  userId: string;
  roleId: string;
}

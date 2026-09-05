import type { PermissionDescriptor, RoleDescriptor, UserPermissionRecord } from './authorization.js';
import type { CreateSessionInput, SessionRecord } from './authentication.js';
import type { TenantBootstrapInput, TenantBootstrapResult } from './bootstrap.js';

export interface PlatformBootstrapRepository {
  seedSubscriptionPlans(
    plans: Array<{
      name: string;
      description?: string | null;
      priceMonthly: number;
      maxUsers?: number | null;
      maxStorageGb?: number | null;
      isActive?: boolean;
    }>,
  ): Promise<void>;
  seedModules(
    modules: Array<{
      code: string;
      name: string;
      moduleGroup?: string;
      description?: string | null;
      icon?: string | null;
      route?: string | null;
      isCore?: boolean;
      sortOrder?: number;
      parentModuleCode?: string | null;
    }>,
  ): Promise<void>;
  seedPermissions(
    permissions: Array<{
      moduleCode: string;
      resource: string;
      action: string;
      scope?: 'own' | 'branch' | 'organization' | 'tenant' | 'global';
      permissionKey: string;
      displayName: string;
      description?: string | null;
      isSystem?: boolean;
    }>,
  ): Promise<void>;
}

export interface LoginCandidate {
  userId: string;
  tenantId: string;
}

export interface UserAccountRecord {
  id: string;
  tenantId: string;
  organizationId?: string | null;
  defaultBranchId?: string | null;
  defaultLocationId?: string | null;
  username: string;
  email: string;
  passwordHash: string;
  status: string;
  failedLoginCount?: number;
  lockedUntil?: Date | string | null;
}

export interface UserRepository {
  findLoginCandidates(identifier: string): Promise<LoginCandidate[]>;
  findByTenantAndIdentifier(tenantId: string, identifier: string): Promise<UserAccountRecord | null>;
  findById(tenantId: string, userId: string): Promise<UserAccountRecord | null>;
  recordFailedLoginAttempt?(
    tenantId: string,
    userId: string,
    options?: { maxFailedAttempts?: number; lockoutMinutes?: number },
  ): Promise<{ failedLoginCount: number; lockedUntil: Date | null }>;
  resetFailedLoginState?(tenantId: string, userId: string): Promise<void>;
  getPermissionKeysForUser(tenantId: string, userId: string): Promise<UserPermissionRecord[]>;
}

export interface SessionRepository {
  createSession(input: CreateSessionInput): Promise<SessionRecord>;
  findSession(sessionId: string, tenantId: string): Promise<SessionRecord | null>;
  findSessionByRefreshTokenHash(tenantId: string, refreshTokenHash: string): Promise<SessionRecord | null>;
  invalidateSession(sessionId: string, tenantId: string): Promise<void>;
}

export interface UserRegistrationRecord {
  id: string;
  tenantId: string;
  organizationId?: string | null;
  defaultBranchId?: string | null;
  defaultLocationId?: string | null;
  username: string;
  email: string;
  status: string;
}

export interface UserRegistrationRepository {
  findById(tenantId: string, userId: string): Promise<UserAccountRecord | null>;
  findByTenantAndIdentifier(tenantId: string, identifier: string): Promise<UserAccountRecord | null>;
  findRoleByTenantAndCode(
    tenantId: string,
    code: string,
  ): Promise<{ id: string; tenantId: string; code: string; name: string } | null>;
  createRole(
    tenantId: string,
    code: string,
    name: string,
  ): Promise<{ id: string; tenantId: string; code: string; name: string }>;
  createUser(input: {
    id?: string;
    tenantId: string;
    organizationId?: string | null;
    defaultBranchId?: string | null;
    defaultLocationId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status?: string;
  }): Promise<UserRegistrationRecord>;
  assignUserToOrganization(tenantId: string, userId: string, organizationId: string): Promise<boolean>;
  assignUserRole(tenantId: string, userId: string, roleId: string): Promise<void>;
}

export interface TenantBootstrapRepository {
  bootstrapTenant(input: TenantBootstrapInput): Promise<TenantBootstrapResult>;
}

export interface CustomerRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  isDeleted: boolean;
  version: number;
}

export interface CustomerListQuery {
  organizationId: string;
  page: number;
  pageSize: number;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface CustomerListResult {
  items: CustomerRecord[];
  total: number;
}

export interface CustomerRepository {
  create(input: {
    tenantId: string;
    organizationId: string;
    name: string;
    actorUserId: string;
  }): Promise<CustomerRecord>;
  getById(tenantId: string, organizationId: string, customerId: string): Promise<CustomerRecord | null>;
  list(tenantId: string, query: CustomerListQuery): Promise<CustomerListResult>;
  update(input: {
    tenantId: string;
    organizationId: string;
    customerId: string;
    name: string;
    actorUserId: string;
  }): Promise<CustomerRecord | null>;
  softDelete(input: {
    tenantId: string;
    organizationId: string;
    customerId: string;
    actorUserId: string;
  }): Promise<CustomerRecord | null>;
}

export interface QuotationItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
}
export interface QuotationItemRecord extends QuotationItemInput {
  id: string;
  lineNumber: number;
}
export interface QuotationRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  branchId: string;
  financialYearId: string;
  quotationNumber: string;
  customerId: string;
  quotationDate: Date;
  validUntil: Date;
  status: import('./quotation.js').QuotationStatus;
  notes: string | null;
  items: QuotationItemRecord[];
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  isDeleted: boolean;
  versionNumber: number;
}
export interface QuotationRepository {
  create(input: {
    tenantId: string;
    organizationId: string;
    branchId: string;
    financialYearId: string;
    customerId: string;
    quotationDate: string;
    validUntil: string;
    notes?: string | null;
    items: QuotationItemInput[];
    actorUserId: string;
  }): Promise<QuotationRecord>;
  getById(
    tenantId: string,
    organizationId: string,
    branchId: string,
    financialYearId: string,
    id: string,
  ): Promise<QuotationRecord | null>;
  list(
    tenantId: string,
    q: {
      organizationId: string;
      branchId: string;
      financialYearId: string;
      page: number;
      pageSize: number;
      order: 'asc' | 'desc';
      search?: string;
    },
  ): Promise<{ items: QuotationRecord[]; total: number }>;
  update(input: {
    tenantId: string;
    organizationId: string;
    branchId: string;
    financialYearId: string;
    quotationId: string;
    customerId: string;
    quotationDate: string;
    validUntil: string;
    notes?: string | null;
    items: QuotationItemInput[];
    actorUserId: string;
  }): Promise<QuotationRecord | null>;
  transition(input: {
    tenantId: string;
    organizationId: string;
    branchId: string;
    financialYearId: string;
    quotationId: string;
    status: import('./quotation.js').QuotationStatus;
    actorUserId: string;
  }): Promise<QuotationRecord | null>;
  softDelete(input: {
    tenantId: string;
    organizationId: string;
    branchId: string;
    financialYearId: string;
    quotationId: string;
    actorUserId: string;
  }): Promise<QuotationRecord | null>;
}

export interface OrderItemRecord extends QuotationItemRecord {}
export interface OrderRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  branchId: string;
  financialYearId: string;
  orderNumber: string;
  customerId: string;
  quotationId: string;
  status: import('./order.js').OrderStatus;
  notes: string | null;
  items: OrderItemRecord[];
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  isDeleted: boolean;
  versionNumber: number;
}
export interface OrderRepository {
  create(input: {
    tenantId: string;
    organizationId: string;
    branchId: string;
    financialYearId: string;
    quotationId: string;
    actorUserId: string;
  }): Promise<OrderRecord>;
  getById(
    tenantId: string,
    organizationId: string,
    branchId: string,
    financialYearId: string,
    id: string,
  ): Promise<OrderRecord | null>;
  list(
    tenantId: string,
    q: {
      organizationId: string;
      branchId: string;
      financialYearId: string;
      page: number;
      pageSize: number;
      order: 'asc' | 'desc';
      search?: string;
    },
  ): Promise<{ items: OrderRecord[]; total: number }>;
  update(input: {
    tenantId: string;
    organizationId: string;
    branchId: string;
    financialYearId: string;
    orderId: string;
    notes: string | null;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<OrderRecord | null>;
  transition(input: {
    tenantId: string;
    organizationId: string;
    branchId: string;
    financialYearId: string;
    orderId: string;
    status: import('./order.js').OrderStatus;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<OrderRecord | null>;
  softDelete(input: {
    tenantId: string;
    organizationId: string;
    branchId: string;
    financialYearId: string;
    orderId: string;
    actorUserId: string;
  }): Promise<OrderRecord | null>;
}

export interface DeliveryItemRecord {
  id: string;
  lineNumber: number;
  orderItemId: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
}
export interface DeliveryRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  branchId: string;
  financialYearId: string;
  deliveryNumber: string;
  salesOrderId: string;
  customerId: string;
  status: import('./delivery.js').DeliveryStatus;
  idempotencyKey: string;
  notes: string | null;
  items: DeliveryItemRecord[];
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  versionNumber: number;
}
export interface DeliveryRepository {
  create(input: {
    tenantId: string;
    organizationId: string;
    branchId: string;
    financialYearId: string;
    salesOrderId: string;
    idempotencyKey: string;
    notes: string | null;
    actorUserId: string;
  }): Promise<DeliveryRecord>;
  getById(tenantId: string, organizationId: string, branchId: string, financialYearId: string, id: string): Promise<DeliveryRecord | null>;
  list(tenantId: string, q: {
    organizationId: string; branchId: string; financialYearId: string;
    page: number; pageSize: number; order: 'asc' | 'desc'; search?: string;
  }): Promise<{ items: DeliveryRecord[]; total: number }>;
  update(input: {
    tenantId: string; organizationId: string; branchId: string; financialYearId: string;
    deliveryId: string; notes: string | null; expectedVersion: number; actorUserId: string;
  }): Promise<DeliveryRecord | null>;
  transition(input: {
    tenantId: string; organizationId: string; branchId: string; financialYearId: string;
    deliveryId: string; status: import('./delivery.js').DeliveryStatus;
    expectedVersion: number; actorUserId: string;
  }): Promise<DeliveryRecord | null>;
}

export interface InvoiceItemRecord {
  id: string;
  lineNumber: number;
  deliveryItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  lineTotal: number;
}
export interface InvoiceRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  branchId: string;
  financialYearId: string;
  invoiceNumber: string;
  salesOrderId: string;
  deliveryId: string;
  customerId: string;
  status: import('./invoice.js').InvoiceStatus;
  idempotencyKey: string;
  financeStatus: 'NOT_CONNECTED';
  taxStatus: 'NOT_CONNECTED';
  financeReference: string | null;
  taxReference: string | null;
  notes: string | null;
  items: InvoiceItemRecord[];
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  versionNumber: number;
}
export interface InvoiceRepository {
  create(input: {
    tenantId: string; organizationId: string; branchId: string; financialYearId: string;
    deliveryId: string; idempotencyKey: string; notes: string | null; actorUserId: string;
  }): Promise<InvoiceRecord>;
  getById(tenantId: string, organizationId: string, branchId: string, financialYearId: string, id: string): Promise<InvoiceRecord | null>;
  list(tenantId: string, q: {
    organizationId: string; branchId: string; financialYearId: string;
    page: number; pageSize: number; order: 'asc' | 'desc'; search?: string;
  }): Promise<{ items: InvoiceRecord[]; total: number }>;
  update(input: {
    tenantId: string; organizationId: string; branchId: string; financialYearId: string;
    invoiceId: string; notes: string | null; expectedVersion: number; actorUserId: string;
  }): Promise<InvoiceRecord | null>;
  transition(input: {
    tenantId: string; organizationId: string; branchId: string; financialYearId: string;
    invoiceId: string; status: import('./invoice.js').InvoiceStatus;
    expectedVersion: number; actorUserId: string;
  }): Promise<InvoiceRecord | null>;
}

export interface SalesReturnItemRecord {
  id: string; lineNumber: number; invoiceItemId: string; description: string;
  quantity: number; unitOfMeasure: string; unitPrice: number;
}
export interface SalesReturnRecord {
  id: string; tenantId: string; organizationId: string; branchId: string; financialYearId: string;
  returnNumber: string; invoiceId: string; deliveryId: string; customerId: string;
  status: import('./sales-return.js').SalesReturnStatus; idempotencyKey: string;
  inventoryStatus: 'NOT_CONNECTED'; financeStatus: 'NOT_CONNECTED'; notes: string | null;
  items: SalesReturnItemRecord[]; createdAt: Date; createdBy: string | null;
  updatedAt: Date | null; updatedBy: string | null; versionNumber: number;
}
export interface SalesReturnRepository {
  create(input: { tenantId: string; organizationId: string; branchId: string; financialYearId: string; invoiceId: string; idempotencyKey: string; notes: string | null; actorUserId: string }): Promise<SalesReturnRecord>;
  getById(tenantId: string, organizationId: string, branchId: string, financialYearId: string, id: string): Promise<SalesReturnRecord | null>;
  list(tenantId: string, q: { organizationId: string; branchId: string; financialYearId: string; page: number; pageSize: number; order: 'asc' | 'desc'; search?: string }): Promise<{ items: SalesReturnRecord[]; total: number }>;
  update(input: { tenantId: string; organizationId: string; branchId: string; financialYearId: string; returnId: string; notes: string | null; expectedVersion: number; actorUserId: string }): Promise<SalesReturnRecord | null>;
  transition(input: { tenantId: string; organizationId: string; branchId: string; financialYearId: string; returnId: string; status: import('./sales-return.js').SalesReturnStatus; expectedVersion: number; actorUserId: string }): Promise<SalesReturnRecord | null>;
}

export interface CreditNoteItemRecord {
  id: string; lineNumber: number; returnItemId: string; description: string;
  quantity: number; unitPrice: number; unitOfMeasure: string; lineTotal: number;
}
export interface CreditNoteRecord {
  id: string; tenantId: string; organizationId: string; branchId: string; financialYearId: string;
  creditNoteNumber: string; returnId: string; invoiceId: string; customerId: string;
  status: import('./credit-note.js').CreditNoteStatus; idempotencyKey: string;
  financeStatus: 'NOT_CONNECTED'; taxStatus: 'NOT_CONNECTED'; notes: string | null;
  items: CreditNoteItemRecord[]; createdAt: Date; createdBy: string | null;
  updatedAt: Date | null; updatedBy: string | null; versionNumber: number;
}
export interface CreditNoteRepository {
  create(input: { tenantId: string; organizationId: string; branchId: string; financialYearId: string; returnId: string; idempotencyKey: string; notes: string | null; actorUserId: string }): Promise<CreditNoteRecord>;
  getById(tenantId: string, organizationId: string, branchId: string, financialYearId: string, id: string): Promise<CreditNoteRecord | null>;
  list(tenantId: string, q: { organizationId: string; branchId: string; financialYearId: string; page: number; pageSize: number; order: 'asc' | 'desc'; search?: string }): Promise<{ items: CreditNoteRecord[]; total: number }>;
  update(input: { tenantId: string; organizationId: string; branchId: string; financialYearId: string; creditNoteId: string; notes: string | null; expectedVersion: number; actorUserId: string }): Promise<CreditNoteRecord | null>;
  transition(input: { tenantId: string; organizationId: string; branchId: string; financialYearId: string; creditNoteId: string; status: import('./credit-note.js').CreditNoteStatus; expectedVersion: number; actorUserId: string }): Promise<CreditNoteRecord | null>;
}

export interface OrganizationRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  legalName?: string | null;
  gstNo?: string | null;
  panNo?: string | null;
  cinNo?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  baseCurrency: string;
  fiscalCalendar: string;
  status: 'active' | 'inactive' | 'archived';
  isDefault: boolean;
  remarks?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  isDeleted?: boolean;
}

export interface BranchRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  code: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  isHeadOffice: boolean;
  isDefault: boolean;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  timezone: string;
  remarks?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  isDeleted?: boolean;
}

export interface LocationRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string | null;
  status: 'active' | 'inactive' | 'archived';
  isDefault: boolean;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  timezone: string;
  remarks?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  isDeleted?: boolean;
}

export interface UserAdminRecord {
  id: string;
  tenantId: string;
  organizationId?: string | null;
  defaultBranchId?: string | null;
  defaultLocationId?: string | null;
  username: string;
  email: string;
  status: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  isDeleted?: boolean;
}

export interface UserOrganizationAccessRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  isDefault: boolean;
}

export interface UserBranchAccessRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  organizationName: string;
  code: string;
  name: string;
  status: string;
}

export interface CoreEnterpriseRepository {
  validateFinancialYear(tenantId: string, organizationId: string, financialYearId: string): Promise<boolean>;
  generateOrganizationCode(tenantId: string): Promise<string>;
  createOrganization(
    tenantId: string,
    input: {
      code?: string | null;
      name: string;
      legalName?: string | null;
      gstNo?: string | null;
      panNo?: string | null;
      cinNo?: string | null;
      email?: string | null;
      phone?: string | null;
      website?: string | null;
      baseCurrency?: string;
      fiscalCalendar?: string;
      status?: 'active' | 'inactive' | 'archived';
      isDefault?: boolean;
      remarks?: string | null;
    },
  ): Promise<OrganizationRecord>;
  listOrganizations(tenantId: string): Promise<OrganizationRecord[]>;
  getOrganizationById(tenantId: string, organizationId: string): Promise<OrganizationRecord | null>;
  updateOrganization(
    tenantId: string,
    organizationId: string,
    changes: Partial<
      Pick<
        OrganizationRecord,
        | 'code'
        | 'name'
        | 'legalName'
        | 'gstNo'
        | 'panNo'
        | 'cinNo'
        | 'email'
        | 'phone'
        | 'website'
        | 'baseCurrency'
        | 'fiscalCalendar'
        | 'status'
        | 'isDefault'
        | 'remarks'
      >
    >,
  ): Promise<OrganizationRecord | null>;
  deactivateOrganization(tenantId: string, organizationId: string): Promise<boolean>;
  generateBranchCode(tenantId: string, organizationId: string): Promise<string>;
  createBranch(
    tenantId: string,
    organizationId: string,
    input: {
      code?: string | null;
      name: string;
      status?: 'active' | 'inactive' | 'archived';
      isHeadOffice?: boolean;
      isDefault?: boolean;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      district?: string | null;
      state?: string | null;
      country?: string | null;
      postalCode?: string | null;
      timezone?: string;
      remarks?: string | null;
    },
  ): Promise<BranchRecord>;
  listBranches(tenantId: string, organizationId: string): Promise<BranchRecord[]>;
  listAccessibleBranchesForUser(
    tenantId: string,
    userId: string,
    organizationId?: string | null,
  ): Promise<BranchRecord[]>;
  getBranchById(tenantId: string, organizationId: string, branchId: string): Promise<BranchRecord | null>;
  getAccessibleBranchByIdForUser(
    tenantId: string,
    userId: string,
    branchId: string,
    organizationId?: string | null,
  ): Promise<BranchRecord | null>;
  validateBranchAccess(
    tenantId: string,
    userId: string,
    branchId: string,
    organizationId?: string | null,
  ): Promise<boolean>;
  updateBranch(
    tenantId: string,
    organizationId: string,
    branchId: string,
    changes: Partial<
      Pick<
        BranchRecord,
        | 'code'
        | 'name'
        | 'status'
        | 'isHeadOffice'
        | 'isDefault'
        | 'addressLine1'
        | 'addressLine2'
        | 'city'
        | 'district'
        | 'state'
        | 'country'
        | 'postalCode'
        | 'timezone'
        | 'remarks'
      >
    >,
  ): Promise<BranchRecord | null>;
  deactivateBranch(tenantId: string, organizationId: string, branchId: string): Promise<boolean>;
  generateLocationCode(tenantId: string, organizationId: string): Promise<string>;
  createLocation(
    tenantId: string,
    organizationId: string,
    input: {
      code: string;
      name: string;
      description?: string | null;
      status?: 'active' | 'inactive' | 'archived';
      isDefault?: boolean;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      postalCode?: string | null;
      timezone?: string;
    },
  ): Promise<LocationRecord>;
  listLocations(tenantId: string, organizationId: string): Promise<LocationRecord[]>;
  listAccessibleLocationsForUser(
    tenantId: string,
    userId: string,
    organizationId?: string | null,
  ): Promise<LocationRecord[]>;
  getLocationById(tenantId: string, organizationId: string, locationId: string): Promise<LocationRecord | null>;
  getAccessibleLocationByIdForUser(
    tenantId: string,
    userId: string,
    locationId: string,
    organizationId?: string | null,
  ): Promise<LocationRecord | null>;
  validateLocationAccess(
    tenantId: string,
    userId: string,
    locationId: string,
    organizationId?: string | null,
  ): Promise<boolean>;
  updateLocation(
    tenantId: string,
    organizationId: string,
    locationId: string,
    changes: Partial<
      Pick<
        LocationRecord,
        | 'code'
        | 'name'
        | 'description'
        | 'status'
        | 'isDefault'
        | 'addressLine1'
        | 'addressLine2'
        | 'city'
        | 'state'
        | 'country'
        | 'postalCode'
        | 'timezone'
      >
    >,
  ): Promise<LocationRecord | null>;
  deactivateLocation(tenantId: string, organizationId: string, locationId: string): Promise<boolean>;
  listUsers(tenantId: string): Promise<UserAdminRecord[]>;
  getUserById(tenantId: string, userId: string): Promise<UserAdminRecord | null>;
  listUserOrganizationAccess(tenantId: string, userId: string): Promise<UserOrganizationAccessRecord[]>;
  listUserBranchAccess(tenantId: string, userId: string): Promise<UserBranchAccessRecord[]>;
  updateUser(
    tenantId: string,
    userId: string,
    changes: Partial<
      Pick<
        UserAdminRecord,
        'username' | 'email' | 'organizationId' | 'defaultBranchId' | 'defaultLocationId' | 'status'
      >
    >,
  ): Promise<UserAdminRecord | null>;
  assignUserToOrganization(tenantId: string, userId: string, organizationId: string): Promise<boolean>;
  assignUserToBranch(tenantId: string, userId: string, branchId: string): Promise<boolean>;
  activateUser(tenantId: string, userId: string): Promise<boolean>;
  deactivateUser(tenantId: string, userId: string): Promise<boolean>;
}

export interface AuthorizationRepository {
  getPermissionKeysForUser(tenantId: string, userId: string): Promise<UserPermissionRecord[]>;
  listRoles(tenantId: string): Promise<
    Array<{
      id: string;
      tenantId: string;
      code: string;
      name: string;
      description?: string | null;
      isSystem: boolean;
      sortOrder: number;
      createdAt?: Date | string | null;
      updatedAt?: Date | string | null;
    }>
  >;
  getRoleById(
    tenantId: string,
    roleId: string,
  ): Promise<{
    id: string;
    tenantId: string;
    code: string;
    name: string;
    description?: string | null;
    isSystem: boolean;
    sortOrder: number;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
  } | null>;
  createRole(
    tenantId: string,
    input: { code: string; name: string; description?: string | null; isSystem?: boolean; sortOrder?: number },
  ): Promise<{
    id: string;
    tenantId: string;
    code: string;
    name: string;
    description?: string | null;
    isSystem: boolean;
    sortOrder: number;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
  }>;
  updateRole(
    tenantId: string,
    roleId: string,
    changes: { code?: string; name?: string; description?: string | null; isSystem?: boolean; sortOrder?: number },
  ): Promise<{
    id: string;
    tenantId: string;
    code: string;
    name: string;
    description?: string | null;
    isSystem: boolean;
    sortOrder: number;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
  } | null>;
  listPermissions(tenantId: string): Promise<
    Array<{
      id: string;
      moduleCode: string;
      resource: string;
      action: string;
      scope: 'own' | 'branch' | 'organization' | 'tenant' | 'global';
      permissionKey: string;
      displayName: string;
      description?: string | null;
      isSystem: boolean;
    }>
  >;
  assignPermissionsToRole(tenantId: string, roleId: string, permissionKeys: string[]): Promise<number>;
  removePermissionsFromRole(tenantId: string, roleId: string, permissionKeys: string[]): Promise<number>;
  replacePermissionsForRole(tenantId: string, roleId: string, permissionKeys: string[]): Promise<number>;
  getPermissionsForRole(tenantId: string, roleId: string): Promise<PermissionDescriptor[]>;
  assignRoleToUser(tenantId: string, userId: string, roleId: string): Promise<boolean>;
  revokeRoleFromUser(tenantId: string, userId: string, roleId: string): Promise<boolean>;
  getRolesForUser(tenantId: string, userId: string): Promise<RoleDescriptor[]>;
  getUserEffectivePermissions(tenantId: string, userId: string): Promise<PermissionDescriptor[]>;
}

export interface AuthenticationRepository extends UserRepository, SessionRepository, UserRegistrationRepository {}

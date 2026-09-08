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
      scope?: 'own' | 'branch' | 'tenant' | 'tenant' | 'global';
      permissionKey: string;
      displayName: string;
      description?: string | null;
      isSystem?: boolean;
    }>,
  ): Promise<void>;
  seedPlatformAuthorization(): Promise<void>;
}

export interface LoginCandidate {
  userId: string;
  tenantId: string;
  identityId?: string;
}

export interface UserAccountRecord {
  id: string;
  identityId?: string;
  tenantId: string;
  defaultBranchId?: string | null;
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
  listActiveSessions(tenantId: string, userId?: string): Promise<SessionRecord[]>;
  invalidateAllSessions(tenantId: string, userId: string, exceptSessionId?: string): Promise<number>;
}

export interface UserRegistrationRecord {
  id: string;
  tenantId: string;
  defaultBranchId?: string | null;
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
    defaultBranchId?: string | null;
    username: string;
    email: string;
    passwordHash: string;
    status?: string;
  }): Promise<UserRegistrationRecord>;
  assignUserRole(tenantId: string, userId: string, roleId: string): Promise<void>;
}

export interface TenantBootstrapRepository {
  bootstrapTenant(input: TenantBootstrapInput): Promise<TenantBootstrapResult>;
}

export interface CustomerRecord {
  [key: string]: unknown;
  id: string;
  tenantId: string;
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
  [key: string]: unknown;
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
    [key: string]: unknown;
    tenantId: string;
    name: string;
    actorUserId: string;
  }): Promise<CustomerRecord>;
  getById(tenantId: string, customerId: string, ...scope: string[]): Promise<CustomerRecord | null>;
  list(tenantId: string, query: CustomerListQuery): Promise<CustomerListResult>;
  update(input: {
    [key: string]: unknown;
    tenantId: string;
    customerId: string;
    name: string;
    actorUserId: string;
  }): Promise<CustomerRecord | null>;
  softDelete(input: {
    [key: string]: unknown;
    tenantId: string;
    customerId: string;
    actorUserId: string;
  }): Promise<CustomerRecord | null>;
}

export interface ItemRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string | null;
  unitOfMeasure: string;
  salesEligible: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  isDeleted: boolean;
  version: number;
}

export interface ItemListQuery {
  page: number;
  pageSize: number;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface ItemRepository {
  create(input: {
    tenantId: string;
    code: string;
    name: string;
    description: string | null;
    unitOfMeasure: string;
    salesEligible: boolean;
    actorUserId: string;
  }): Promise<ItemRecord>;
  getById(tenantId: string, itemId: string): Promise<ItemRecord | null>;
  list(tenantId: string, query: ItemListQuery): Promise<{ items: ItemRecord[]; total: number }>;
  update(input: {
    tenantId: string;
    itemId: string;
    name: string;
    description: string | null;
    unitOfMeasure: string;
    salesEligible: boolean;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<ItemRecord | null>;
  softDelete(input: {
    tenantId: string;
    itemId: string;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<ItemRecord | null>;
}

import type { MovementType, ReservationStatus, WarehouseStatus } from './inventory.js';

export interface WarehouseRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  status: WarehouseStatus;
  version: number;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface InventoryStockRecord {
  id: string;
  tenantId: string;
  warehouseId: string;
  itemId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  version: number;
}

export interface InventoryReservationRecord {
  id: string;
  tenantId: string;
  branchId: string;
  financialYearId: string;
  warehouseId: string;
  itemId: string;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  quantity: number;
  status: ReservationStatus;
  version: number;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface InventoryMovementRecord {
  id: string;
  tenantId: string;
  branchId: string;
  financialYearId: string;
  warehouseId: string;
  itemId: string;
  movementType: MovementType;
  quantity: number;
  sourceType: string;
  sourceId: string;
  operationKey: string;
  createdAt: Date;
  createdBy: string | null;
}

export interface InventoryRepository {
  createWarehouse(input: {
    tenantId: string;
    code: string;
    name: string;
    actorUserId: string;
  }): Promise<WarehouseRecord>;
  listWarehouses(
    tenantId: string,
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<{ items: WarehouseRecord[]; total: number }>;
  updateWarehouse(input: {
    tenantId: string;
    warehouseId: string;
    name: string;
    status: WarehouseStatus;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<WarehouseRecord | null>;
  listStock(
    tenantId: string,
    page: number,
    pageSize: number,
    warehouseId?: string,
    itemId?: string,
  ): Promise<{ items: InventoryStockRecord[]; total: number }>;
  receiveStock(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    warehouseId: string;
    itemId: string;
    quantity: number;
    sourceType: string;
    sourceId: string;
    operationKey: string;
    actorUserId: string;
  }): Promise<InventoryStockRecord>;
  reserveStock(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    warehouseId: string;
    itemId: string;
    quantity: number;
    sourceType: string;
    sourceId: string;
    idempotencyKey: string;
    actorUserId: string;
  }): Promise<InventoryReservationRecord>;
  listReservations(input: {
    tenantId: string;
    page: number;
    pageSize: number;
    status?: ReservationStatus;
  }): Promise<{ items: InventoryReservationRecord[]; total: number }>;
  listReservationsBySource(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    sourceType: string;
    sourceId: string;
  }): Promise<InventoryReservationRecord[]>;
  fulfillReservationsBySource(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    sourceType: string;
    sourceId: string;
    operationKey: string;
    actorUserId: string;
  }): Promise<InventoryReservationRecord[]>;
  releaseReservation(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    reservationId: string;
    operationKey: string;
    actorUserId: string;
  }): Promise<InventoryReservationRecord>;
  fulfillReservation(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    reservationId: string;
    operationKey: string;
    actorUserId: string;
  }): Promise<InventoryReservationRecord>;
  returnStock(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    warehouseId: string;
    itemId: string;
    quantity: number;
    sourceType: string;
    sourceId: string;
    operationKey: string;
    actorUserId: string;
  }): Promise<InventoryMovementRecord>;
}

export interface QuotationItemInput {
  itemId?: string | null;
  itemCode?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  discountPercentage?: number;
  discountAmount?: number;
  lineTotal?: number;
  priceListId?: string | null;
  discountRuleId?: string | null;
}
export interface QuotationItemRecord extends QuotationItemInput {
  id: string;
  lineNumber: number;
}
export interface QuotationRecord {
  id: string;
  tenantId: string;
  branchId: string;
  financialYearId: string;
  quotationNumber: string;
  customerId: string;
  quotationDate: Date;
  validUntil: Date;
  status: import('./quotation.js').QuotationStatus;
  notes: string | null;
  subtotal?: number;
  discountTotal?: number;
  total?: number;
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
    branchId: string;
    financialYearId: string;
    customerId: string;
    quotationDate: string;
    validUntil: string;
    notes?: string | null;
    items: QuotationItemInput[];
    subtotal?: number;
    discountTotal?: number;
    total?: number;
    actorUserId: string;
  }): Promise<QuotationRecord>;
  getById(
    tenantId: string,
    branchId: string,
    financialYearId: string,
    id: string,
  ): Promise<QuotationRecord | null>;
  list(
    tenantId: string,
    q: {
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
    branchId: string;
    financialYearId: string;
    quotationId: string;
    customerId: string;
    quotationDate: string;
    validUntil: string;
    notes?: string | null;
    items: QuotationItemInput[];
    subtotal?: number;
    discountTotal?: number;
    total?: number;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<QuotationRecord | null>;
  transition(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    quotationId: string;
    status: import('./quotation.js').QuotationStatus;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<QuotationRecord | null>;
  softDelete(input: {
    tenantId: string;
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
  branchId: string;
  financialYearId: string;
  orderNumber: string;
  customerId: string;
  quotationId: string;
  warehouseId?: string | null;
  reservationStatus?: 'NOT_RESERVED' | 'RESERVED';
  status: import('./order.js').OrderStatus;
  notes: string | null;
  items: OrderItemRecord[];
  subtotal?: number;
  discountTotal?: number;
  total?: number;
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
    branchId: string;
    financialYearId: string;
    quotationId: string;
    warehouseId?: string;
    actorUserId: string;
    subtotal?: number;
    discountTotal?: number;
    total?: number;
  }): Promise<OrderRecord>;
  getById(
    tenantId: string,
    branchId: string,
    financialYearId: string,
    id: string,
  ): Promise<OrderRecord | null>;
  list(
    tenantId: string,
    q: {
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
    branchId: string;
    financialYearId: string;
    orderId: string;
    notes: string | null;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<OrderRecord | null>;
  transition(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    orderId: string;
    status: import('./order.js').OrderStatus;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<OrderRecord | null>;
  updateReservationStatus?(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    orderId: string;
    reservationStatus: 'NOT_RESERVED' | 'RESERVED';
    actorUserId: string;
  }): Promise<OrderRecord | null>;
  softDelete(input: {
    tenantId: string;
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
  itemId: string | null;
  reservationId: string | null;
  description: string;
  quantity: number;
  unitOfMeasure: string;
}
export interface DeliveryRecord {
  id: string;
  tenantId: string;
  branchId: string;
  financialYearId: string;
  deliveryNumber: string;
  salesOrderId: string;
  warehouseId?: string | null;
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
  attachReservationReferences?(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    deliveryId: string;
    references: Array<{ orderItemId: string; reservationId: string }>;
    actorUserId: string;
  }): Promise<DeliveryRecord | null>;
  create(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    salesOrderId: string;
    idempotencyKey: string;
    notes: string | null;
    actorUserId: string;
    allowReplay?: boolean;
  }): Promise<DeliveryRecord>;
  getById(
    tenantId: string,
    branchId: string,
    financialYearId: string,
    id: string,
  ): Promise<DeliveryRecord | null>;
  list(
    tenantId: string,
    q: {
      branchId: string;
      financialYearId: string;
      page: number;
      pageSize: number;
      order: 'asc' | 'desc';
      search?: string;
    },
  ): Promise<{ items: DeliveryRecord[]; total: number }>;
  update(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    deliveryId: string;
    notes: string | null;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<DeliveryRecord | null>;
  transition(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    deliveryId: string;
    status: import('./delivery.js').DeliveryStatus;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<DeliveryRecord | null>;
}

export interface InvoiceItemRecord {
  id: string;
  lineNumber: number;
  deliveryItemId: string;
  itemCode?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  lineTotal: number;
  discountPercentage: number;
  discountAmount: number;
  priceListId?: string | null;
  discountRuleId?: string | null;
}
export interface InvoiceRecord {
  id: string;
  tenantId: string;
  branchId: string;
  financialYearId: string;
  invoiceNumber: string;
  salesOrderId: string;
  deliveryId: string;
  customerId: string;
  status: import('./invoice.js').InvoiceStatus;
  idempotencyKey: string;
  financeStatus: 'NOT_CONNECTED' | 'POSTED';
  taxStatus: 'NOT_CONNECTED' | 'CALCULATED';
  financeReference: string | null;
  taxReference: string | null;
  taxableAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  subtotal?: number;
  discountTotal?: number;
  total?: number;
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
    tenantId: string;
    branchId: string;
    financialYearId: string;
    deliveryId: string;
    idempotencyKey: string;
    notes: string | null;
    actorUserId: string;
    allowReplay?: boolean;
  }): Promise<InvoiceRecord>;
  getById(
    tenantId: string,
    branchId: string,
    financialYearId: string,
    id: string,
  ): Promise<InvoiceRecord | null>;
  list(
    tenantId: string,
    q: {
      branchId: string;
      financialYearId: string;
      page: number;
      pageSize: number;
      order: 'asc' | 'desc';
      search?: string;
    },
  ): Promise<{ items: InvoiceRecord[]; total: number }>;
  update(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    invoiceId: string;
    notes: string | null;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<InvoiceRecord | null>;
  transition(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    invoiceId: string;
    status: import('./invoice.js').InvoiceStatus;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<InvoiceRecord | null>;
  updateTaxSnapshot?(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    invoiceId: string;
    taxReference: string;
    taxRate: number;
    taxableAmount: number;
    taxAmount: number;
    actorUserId: string;
  }): Promise<InvoiceRecord | null>;
  updateFinanceStatus?(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    invoiceId: string;
    financeReference: string;
    actorUserId: string;
  }): Promise<InvoiceRecord | null>;
}

export interface SalesReturnItemRecord {
  id: string;
  lineNumber: number;
  invoiceItemId: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  itemId?: string | null;
  warehouseId?: string | null;
}
export interface SalesReturnRecord {
  id: string;
  tenantId: string;
  branchId: string;
  financialYearId: string;
  returnNumber: string;
  invoiceId: string;
  deliveryId: string;
  customerId: string;
  status: import('./sales-return.js').SalesReturnStatus;
  idempotencyKey: string;
  warehouseId?: string | null;
  inventoryStatus: 'NOT_CONNECTED' | 'COMPLETED';
  financeStatus: 'NOT_CONNECTED';
  notes: string | null;
  items: SalesReturnItemRecord[];
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  versionNumber: number;
}
export interface SalesReturnRepository {
  create(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    invoiceId: string;
    idempotencyKey: string;
    notes: string | null;
    items?: Array<{ invoiceItemId: string; quantity: number }>;
    actorUserId: string;
    allowReplay?: boolean;
  }): Promise<SalesReturnRecord>;
  getById(
    tenantId: string,
    branchId: string,
    financialYearId: string,
    id: string,
  ): Promise<SalesReturnRecord | null>;
  list(
    tenantId: string,
    q: {
      branchId: string;
      financialYearId: string;
      page: number;
      pageSize: number;
      order: 'asc' | 'desc';
      search?: string;
    },
  ): Promise<{ items: SalesReturnRecord[]; total: number }>;
  update(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    returnId: string;
    notes: string | null;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<SalesReturnRecord | null>;
  transition(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    returnId: string;
    status: import('./sales-return.js').SalesReturnStatus;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<SalesReturnRecord | null>;
  process(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    returnId: string;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<SalesReturnRecord | null>;
}

export interface CreditNoteItemRecord {
  id: string;
  lineNumber: number;
  returnItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  lineTotal: number;
}
export interface CreditNoteRecord {
  id: string;
  tenantId: string;
  branchId: string;
  financialYearId: string;
  creditNoteNumber: string;
  returnId: string;
  invoiceId: string;
  customerId: string;
  status: import('./credit-note.js').CreditNoteStatus;
  idempotencyKey: string;
  financeStatus: 'NOT_CONNECTED' | 'POSTED';
  taxStatus: 'NOT_CONNECTED';
  financeReference?: string | null;
  notes: string | null;
  items: CreditNoteItemRecord[];
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  versionNumber: number;
}
export interface CreditNoteRepository {
  create(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    returnId: string;
    idempotencyKey: string;
    notes: string | null;
    actorUserId: string;
    allowReplay?: boolean;
  }): Promise<CreditNoteRecord>;
  getById(
    tenantId: string,
    branchId: string,
    financialYearId: string,
    id: string,
  ): Promise<CreditNoteRecord | null>;
  list(
    tenantId: string,
    q: {
      branchId: string;
      financialYearId: string;
      page: number;
      pageSize: number;
      order: 'asc' | 'desc';
      search?: string;
    },
  ): Promise<{ items: CreditNoteRecord[]; total: number }>;
  update(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    creditNoteId: string;
    notes: string | null;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<CreditNoteRecord | null>;
  transition(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    creditNoteId: string;
    status: import('./credit-note.js').CreditNoteStatus;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<CreditNoteRecord | null>;
  updateFinanceStatus?(input: {
    tenantId: string;
    branchId: string;
    financialYearId: string;
    creditNoteId: string;
    financeReference: string;
    actorUserId: string;
  }): Promise<CreditNoteRecord | null>;
}

export interface BranchRecord {
  id: string;
  tenantId: string;
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

export interface UserAdminRecord {
  id: string;
  tenantId: string;
  defaultBranchId?: string | null;
  username: string;
  email: string;
  status: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  isDeleted?: boolean;
}

export interface UserBranchAccessRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  status: string;
}

export interface CoreEnterpriseRepository {
  validateFinancialYear(tenantId: string, financialYearId: string): Promise<boolean>;
  generateBranchCode(tenantId: string): Promise<string>;
  createBranch(
    tenantId: string,
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
  listBranches(tenantId: string): Promise<BranchRecord[]>;
  listAccessibleBranchesForUser(
    tenantId: string,
    userId: string,
  ): Promise<BranchRecord[]>;
  getBranchById(tenantId: string, branchId: string): Promise<BranchRecord | null>;
  getAccessibleBranchByIdForUser(
    tenantId: string,
    userId: string,
    branchId: string,
  ): Promise<BranchRecord | null>;
  validateBranchAccess(
    tenantId: string,
    userId: string,
    branchId: string,
  ): Promise<boolean>;
  updateBranch(
    tenantId: string,
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
  deactivateBranch(tenantId: string, branchId: string): Promise<boolean>;
  activateBranch(tenantId: string, branchId: string): Promise<boolean>;
  deleteBranch(tenantId: string, branchId: string): Promise<boolean>;
  listUsers(tenantId: string): Promise<UserAdminRecord[]>;
  getUserById(tenantId: string, userId: string): Promise<UserAdminRecord | null>;
  listUserBranchAccess(tenantId: string, userId: string): Promise<UserBranchAccessRecord[]>;
  updateUser(
    tenantId: string,
    userId: string,
    changes: Partial<
      Pick<
        UserAdminRecord,
        'username' | 'email' | 'defaultBranchId' | 'status'
      >
    >,
  ): Promise<UserAdminRecord | null>;
  assignUserToBranch(tenantId: string, userId: string, branchId: string): Promise<boolean>;
  revokeUserBranchAccess(tenantId: string, userId: string, branchId: string): Promise<boolean>;
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
  activateRole?(tenantId: string, roleId: string): Promise<boolean>;
  deactivateRole?(tenantId: string, roleId: string): Promise<boolean>;
  deleteRole?(tenantId: string, roleId: string): Promise<boolean>;
  listPermissions(tenantId: string): Promise<
    Array<{
      id: string;
      moduleCode: string;
      resource: string;
      action: string;
      scope: 'own' | 'branch' | 'tenant' | 'tenant' | 'global';
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

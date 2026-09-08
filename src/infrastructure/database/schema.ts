import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  integer,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const tenantStatusEnum = pgEnum('tenant_status_enum', [
  'active',
  'suspended',
  'trial',
  'expired',
  'cancelled',
  'maintenance',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status_enum', [
  'active',
  'past_due',
  'canceled',
  'trialing',
]);

export const userStatusEnum = pgEnum('user_status_enum', ['active', 'inactive', 'locked', 'pending_verification']);

export const branchStatusEnum = pgEnum('branch_status_enum', ['active', 'inactive', 'archived']);

export const fyStatusEnum = pgEnum('fy_status_enum', ['open', 'closed', 'locked']);
export const quotationStatusEnum = pgEnum('quotation_status_enum', [
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
]);
export const salesOrderStatusEnum = pgEnum('sales_order_status_enum', ['DRAFT', 'CONFIRMED', 'CANCELLED', 'CLOSED']);

export const resetPolicyEnum = pgEnum('reset_policy_enum', ['financial_year', 'calendar_year', 'monthly', 'never']);

export const permissionScopeEnum = pgEnum('permission_scope_enum', [
  'own',
  'branch',
  'tenant',
  'global',
]);

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    subdomain: varchar('subdomain', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    timezone: varchar('timezone', { length: 100 }).notNull().default('UTC'),
    currency: varchar('currency', { length: 10 }).notNull().default('USD'),
    locale: varchar('locale', { length: 20 }).notNull().default('en_US'),
    status: tenantStatusEnum('status').notNull().default('trial'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    version: integer('version').notNull().default(1),
  },
  (table) => ({
    uqTenantSubdomainActive: uniqueIndex('uq_tenant_subdomain_active')
      .on(table.subdomain)
      .where(sql`${table.isDeleted} = false`),
    uqTenantSlugActive: uniqueIndex('uq_tenant_slug_active')
      .on(table.slug)
      .where(sql`${table.isDeleted} = false`),
    checkTenantSoftDelete: check(
      'check_tenant_soft_delete',
      sql`(((${table.isDeleted}) = false AND (${table.deletedAt}) IS NULL) OR ((${table.isDeleted}) = true AND (${table.deletedAt}) IS NOT NULL))`,
    ),
  }),
);

export const tenantSubscriptions = pgTable(
  'tenant_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionPlanId: uuid('subscription_plan_id').notNull(),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    version: integer('version').notNull().default(1),
  },
  (table) => ({
    checkSubSoftDelete: check(
      'check_sub_soft_delete',
      sql`(((${table.isDeleted}) = false AND (${table.deletedAt}) IS NULL) OR ((${table.isDeleted}) = true AND (${table.deletedAt}) IS NOT NULL))`,
    ),
    checkSubscriptionDates: check('check_subscription_dates', sql`${table.startsAt} < ${table.expiresAt}`),
  }),
);

export const tenantModules = pgTable(
  'tenant_modules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    enabledAt: timestamp('enabled_at', { withTimezone: true }).notNull().defaultNow(),
    enabledBy: uuid('enabled_by'),
    enabledReason: text('enabled_reason'),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    disabledBy: uuid('disabled_by'),
  },
  (table) => ({
    uniqueTenantModule: uniqueIndex('unique_tenant_module').on(table.tenantId, table.moduleId),
    checkTenantModuleLifecycle: check(
      'check_tenant_module_lifecycle',
      sql`(((${table.enabled}) = true AND (${table.disabledAt}) IS NULL) OR ((${table.enabled}) = false AND (${table.disabledAt}) IS NOT NULL))`,
    ),
  }),
);

export const codeCounters = pgTable(
  'code_counters',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    entityType: varchar('entity_type', { length: 32 }).notNull(),
    scopeKey: varchar('scope_key', { length: 64 }).notNull(),
    lastValue: integer('last_value').notNull().default(0),
  },
  (table) => ({
    pkCodeCounter: primaryKey({
      columns: [table.tenantId, table.entityType, table.scopeKey],
      name: 'code_counters_pkey',
    }),
  }),
);

export const branches = pgTable(
  'branches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    status: branchStatusEnum('status').notNull().default('active'),
    isHeadOffice: boolean('is_head_office').notNull().default(false),
    isDefault: boolean('is_default').notNull().default(false),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: varchar('city', { length: 100 }),
    district: varchar('district', { length: 100 }),
    state: varchar('state', { length: 100 }),
    country: varchar('country', { length: 100 }),
    postalCode: varchar('postal_code', { length: 20 }),
    timezone: varchar('timezone', { length: 100 }).notNull().default('UTC'),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    version: integer('version').notNull().default(1),
  },
  (table) => ({
    uqBranchIdTenant: uniqueIndex('uq_branch_id_tenant').on(table.id, table.tenantId),
    uqTenantBranchCodeActive: uniqueIndex('uq_tenant_branch_code_active')
      .on(table.tenantId, table.code)
      .where(sql`${table.isDeleted} = false`),
    uqHeadOffice: uniqueIndex('uq_head_office')
      .on(table.tenantId)
      .where(sql`${table.isHeadOffice} = true AND ${table.isDeleted} = false`),
    uqDefaultBranch: uniqueIndex('uq_default_branch')
      .on(table.tenantId)
      .where(sql`${table.isDefault} = true AND ${table.isDeleted} = false`),
    checkBranchSoftDelete: check(
      'check_branch_soft_delete',
      sql`(((${table.isDeleted}) = false AND (${table.deletedAt}) IS NULL) OR ((${table.isDeleted}) = true AND (${table.deletedAt}) IS NOT NULL))`,
    ),
  }),
);

/** Inventory warehouse is a domain-owned physical location inside a tenant. */
export const inventoryWarehouses = pgTable(
  'inventory_warehouses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    version: integer('version').notNull().default(1),
  },
  (table) => ({
    uqInventoryWarehouseIdTenant: uniqueIndex('uq_inventory_warehouse_id_tenant').on(table.id, table.tenantId),
    uqInventoryWarehouseCode: uniqueIndex('uq_inventory_warehouse_code').on(
      table.tenantId,
      table.code,
    ),
    checkInventoryWarehouseStatus: check(
      'check_inventory_warehouse_status',
      sql`${table.status} IN ('ACTIVE', 'INACTIVE')`,
    ),
  }),
);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    version: integer('version').notNull().default(1),
  },
  (table) => ({
    uqCustomerIdTenant: uniqueIndex('uq_customer_id_tenant').on(table.id, table.tenantId),
    idxCustomerTenantName: index('idx_customer_tenant_name')
      .on(table.tenantId, table.name, table.id)
      .where(sql`${table.isDeleted} = false`),
    checkCustomerSoftDelete: check(
      'check_customer_soft_delete',
      sql`(((${table.isDeleted}) = false AND (${table.deletedAt}) IS NULL) OR ((${table.isDeleted}) = true AND (${table.deletedAt}) IS NOT NULL))`,
    ),
  }),
);

export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    unitOfMeasure: varchar('unit_of_measure', { length: 50 }).notNull(),
    salesEligible: boolean('sales_eligible').notNull().default(true),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    version: integer('version').notNull().default(1),
  },
  (table) => ({
    uqInventoryItemCode: uniqueIndex('uq_inventory_item_code')
      .on(table.tenantId, table.code)
      .where(sql`${table.isDeleted} = false`),
    idxInventoryItemName: index('idx_inventory_item_name')
      .on(table.tenantId, table.name, table.id)
      .where(sql`${table.isDeleted} = false`),
    checkInventoryItemSoftDelete: check(
      'check_inventory_item_soft_delete',
      sql`(((${table.isDeleted}) = false AND (${table.deletedAt}) IS NULL) OR ((${table.isDeleted}) = true AND (${table.deletedAt}) IS NOT NULL))`,
    ),
  }),
);

export const salesQuotations = pgTable(
  'sales_quotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id'),
    financialYearId: uuid('financial_year_id'),
    quotationNumber: varchar('quotation_number', { length: 50 }).notNull(),
    customerId: uuid('customer_id').notNull(),
    quotationDate: date('quotation_date').notNull(),
    validUntil: date('valid_until').notNull(),
    status: quotationStatusEnum('status').notNull().default('DRAFT'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    versionNumber: integer('version_number').notNull().default(1),
  },
  (table) => ({
    uqSalesQuotationNumber: uniqueIndex('uq_sales_quotation_number').on(table.tenantId, table.quotationNumber),
    uqSalesQuotationIdTenant: uniqueIndex('uq_sales_quotation_id_tenant').on(table.id, table.tenantId),
    uqSalesQuotationContext: uniqueIndex('uq_sales_quotation_context').on(
      table.id,
      table.tenantId,
      table.branchId,
      table.financialYearId,
    ),
    idxSalesQuotationList: index('idx_sales_quotation_list').on(
      table.tenantId,
      table.quotationNumber,
      table.id,
    ),
    fkSalesQuotationBranchTenant: foreignKey({
      columns: [table.branchId, table.tenantId],
      foreignColumns: [branches.id, branches.tenantId],
      name: 'fk_sales_quotation_branch_tenant',
    }),
    fkSalesQuotationFinancialYearTenant: foreignKey({
      columns: [table.financialYearId, table.tenantId],
      foreignColumns: [financialYears.id, financialYears.tenantId],
      name: 'fk_sales_quotation_financial_year_tenant',
    }),
    fkSalesQuotationCustomerTenant: foreignKey({
      columns: [table.customerId, table.tenantId],
      foreignColumns: [customers.id, customers.tenantId],
      name: 'fk_sales_quotation_customer_tenant',
    }),
    checkSalesQuotationDates: check('check_sales_quotation_dates', sql`${table.validUntil} >= ${table.quotationDate}`),
  }),
);

export const salesQuotationItems = pgTable(
  'sales_quotation_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id'),
    financialYearId: uuid('financial_year_id'),
    quotationId: uuid('quotation_id').notNull(),
    itemId: uuid('item_id'),
    lineNumber: integer('line_number').notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).notNull(),
    unitOfMeasure: varchar('unit_of_measure', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    versionNumber: integer('version_number').notNull().default(1),
  },
  (table) => ({
    uqSalesQuotationItemLine: uniqueIndex('uq_sales_quote_item_line').on(table.quotationId, table.lineNumber),
    fkSalesQuoteItemQuote: foreignKey({
      columns: [table.quotationId, table.tenantId],
      foreignColumns: [salesQuotations.id, salesQuotations.tenantId],
      name: 'fk_sales_quote_item_quote',
    }),
    checkSalesQuoteItemQuantity: check('check_sales_quote_item_quantity', sql`${table.quantity} > 0`),
    checkSalesQuoteItemPrice: check('check_sales_quote_item_price', sql`${table.unitPrice} >= 0`),
  }),
);

export const salesOrders = pgTable(
  'sales_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull(),
    financialYearId: uuid('financial_year_id').notNull(),
    orderNumber: varchar('order_number', { length: 50 }).notNull(),
    customerId: uuid('customer_id').notNull(),
    quotationId: uuid('quotation_id').notNull(),
    warehouseId: uuid('warehouse_id'),
    reservationStatus: varchar('reservation_status', { length: 20 }).notNull().default('NOT_RESERVED'),
    status: salesOrderStatusEnum('status').notNull().default('DRAFT'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    versionNumber: integer('version_number').notNull().default(1),
  },
  (table) => ({
    uqSalesOrderNumber: uniqueIndex('uq_sales_order_number').on(table.tenantId, table.orderNumber),
    fkSalesOrderBranchTenant: foreignKey({
      columns: [table.branchId, table.tenantId],
      foreignColumns: [branches.id, branches.tenantId],
      name: 'fk_sales_order_branch_tenant',
    }),
    fkSalesOrderFinancialYearTenant: foreignKey({
      columns: [table.financialYearId, table.tenantId],
      foreignColumns: [financialYears.id, financialYears.tenantId],
      name: 'fk_sales_order_fy_tenant',
    }),
    uqSalesOrderContext: uniqueIndex('uq_sales_order_context').on(
      table.id,
      table.tenantId,
      table.branchId,
      table.financialYearId,
    ),
    fkSalesOrderQuotation: foreignKey({
      columns: [table.quotationId, table.tenantId, table.branchId, table.financialYearId],
      foreignColumns: [
        salesQuotations.id,
        salesQuotations.tenantId,
        salesQuotations.branchId,
        salesQuotations.financialYearId,
      ],
      name: 'fk_sales_order_quotation_context',
    }),
  }),
);

export const salesOrderItems = pgTable(
  'sales_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull(),
    financialYearId: uuid('financial_year_id').notNull(),
    orderId: uuid('order_id').notNull(),
    itemId: uuid('item_id'),
    lineNumber: integer('line_number').notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).notNull(),
    unitOfMeasure: varchar('unit_of_measure', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    versionNumber: integer('version_number').notNull().default(1),
  },
  (table) => ({
    uqSalesOrderItemLine: uniqueIndex('uq_sales_order_item_line').on(table.orderId, table.lineNumber),
    fkSalesOrderItemOrder: foreignKey({
      columns: [table.orderId, table.tenantId, table.branchId, table.financialYearId],
      foreignColumns: [
        salesOrders.id,
        salesOrders.tenantId,
        salesOrders.branchId,
        salesOrders.financialYearId,
      ],
      name: 'fk_sales_order_item_order_context',
    }),
  }),
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    defaultBranchId: uuid('default_branch_id'),
    username: varchar('username', { length: 150 }).notNull(),
    // The PostgreSQL `citext` extension is created in the migration.
    // Drizzle does not expose a native `citext` column builder in this version, so the app schema
    // uses `varchar` while the migration preserves the database-level `CITEXT` type.
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    status: userStatusEnum('status').notNull().default('active'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    passwordResetTokenHash: varchar('password_reset_token_hash', { length: 255 }),
    passwordResetExpiresAt: timestamp('password_reset_expires_at', { withTimezone: true }),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    encryptedMfaSecret: text('encrypted_mfa_secret'),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    version: integer('version').notNull().default(1),
  },
  (table) => ({
    fkUserBranchTenant: foreignKey({
      columns: [table.defaultBranchId, table.tenantId],
      foreignColumns: [branches.id, branches.tenantId],
      name: 'fk_user_branch_tenant',
    }),
    uqUserIdTenant: uniqueIndex('uq_user_id_tenant').on(table.id, table.tenantId),
    uqTenantEmailActive: uniqueIndex('uq_tenant_email_active')
      .on(table.tenantId, table.email)
      .where(sql`${table.isDeleted} = false`),
    uqTenantUsernameActive: uniqueIndex('uq_tenant_username_active')
      .on(table.tenantId, table.username)
      .where(sql`${table.isDeleted} = false`),
    checkUserSoftDelete: check(
      'check_user_soft_delete',
      sql`(((${table.isDeleted}) = false AND (${table.deletedAt}) IS NULL) OR ((${table.isDeleted}) = true AND (${table.deletedAt}) IS NOT NULL))`,
    ),
    checkUserResetExpiry: check(
      'check_user_reset_expiry',
      sql`(${table.passwordResetExpiresAt} IS NULL OR ${table.passwordResetTokenHash} IS NOT NULL)`,
    ),
  }),
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    branchId: uuid('branch_id'),
    financialYearId: uuid('financial_year_id'),
    accessTokenId: varchar('access_token_id', { length: 255 }),
    refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),
    device: varchar('device', { length: 255 }),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
    location: varchar('location', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: uuid('revoked_by'),
    terminationReason: varchar('termination_reason', { length: 100 }),
    loginAt: timestamp('login_at', { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    logoutAt: timestamp('logout_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
  },
  (table) => ({
    fkSessionUserTenant: foreignKey({
      columns: [table.userId, table.tenantId],
      foreignColumns: [users.id, users.tenantId],
      name: 'fk_session_user_tenant',
    }),
    fkSessionBranchTenant: foreignKey({
      columns: [table.branchId, table.tenantId],
      foreignColumns: [branches.id, branches.tenantId],
      name: 'fk_session_branch_tenant',
    }),
    checkSessionExpiry: check('check_session_expiry', sql`${table.expiresAt} > ${table.loginAt}`),
    checkSessionActivity: check('check_session_activity', sql`${table.lastActivityAt} >= ${table.loginAt}`),
    checkSessionLogout: check(
      'check_session_logout',
      sql`${table.logoutAt} IS NULL OR ${table.logoutAt} >= ${table.loginAt}`,
    ),
    checkSessionRevocationCoherence: check(
      'check_session_revocation_coherence',
      sql`(((${table.revokedAt}) IS NULL AND (${table.terminationReason}) IS NULL) OR ((${table.revokedAt}) IS NOT NULL))`,
    ),
  }),
);

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    version: integer('version').notNull().default(1),
  },
  (table) => ({
    uqRoleIdTenant: uniqueIndex('uq_role_id_tenant').on(table.id, table.tenantId),
    uqTenantRoleNameActive: uniqueIndex('uq_tenant_role_name_active')
      .on(table.tenantId, table.name)
      .where(sql`${table.isDeleted} = false`),
    uqTenantRoleCodeActive: uniqueIndex('uq_tenant_role_code_active')
      .on(table.tenantId, table.code)
      .where(sql`${table.isDeleted} = false`),
    checkRoleSoftDelete: check(
      'check_role_soft_delete',
      sql`(((${table.isDeleted}) = false AND (${table.deletedAt}) IS NULL) OR ((${table.isDeleted}) = true AND (${table.deletedAt}) IS NOT NULL))`,
    ),
  }),
);

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleCode: varchar('module_code', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  scope: permissionScopeEnum('scope').notNull().default('tenant'),
  permissionKey: varchar('permission_key', { length: 150 }).notNull().unique(),
  displayName: varchar('display_name', { length: 150 }).notNull(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id').notNull(),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pkRolePermissionTenant: primaryKey({
      columns: [table.roleId, table.permissionId, table.tenantId],
      name: 'role_permissions_pkey',
    }),
    fkRolePermissionsRole: foreignKey({
      columns: [table.roleId, table.tenantId],
      foreignColumns: [roles.id, roles.tenantId],
      name: 'fk_role_permissions_role',
    }),
    idxRolePermissionsTenantRole: uniqueIndex('idx_role_permissions_tenant_role').on(table.tenantId, table.roleId),
  }),
);

export const userRoles = pgTable(
  'user_roles',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id').notNull(),
  },
  (table) => ({
    pkUserRoleTenant: primaryKey({ columns: [table.userId, table.roleId, table.tenantId], name: 'user_roles_pkey' }),
    fkUserRolesUser: foreignKey({
      columns: [table.userId, table.tenantId],
      foreignColumns: [users.id, users.tenantId],
      name: 'fk_user_roles_user',
    }),
    fkUserRolesRole: foreignKey({
      columns: [table.roleId, table.tenantId],
      foreignColumns: [roles.id, roles.tenantId],
      name: 'fk_user_roles_role',
    }),
    idxUserRolesTenantUser: uniqueIndex('idx_user_roles_tenant_user').on(table.tenantId, table.userId),
  }),
);

export const userPermissions = pgTable(
  'user_permissions',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    allow: boolean('allow').notNull().default(true),
  },
  (table) => ({
    pkUserPermissionTenant: primaryKey({
      columns: [table.userId, table.permissionId, table.tenantId],
      name: 'user_permissions_pkey',
    }),
    fkUserPermsUser: foreignKey({
      columns: [table.userId, table.tenantId],
      foreignColumns: [users.id, users.tenantId],
      name: 'fk_user_perms_user',
    }),
    idxUserPermissionsTenantUser: uniqueIndex('idx_user_permissions_tenant_user').on(table.tenantId, table.userId),
  }),
);

export const userBranchAccess = pgTable(
  'user_branch_access',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    branchId: uuid('branch_id').notNull(),
  },
  (table) => ({
    pkUserBranchAccessTenant: primaryKey({
      columns: [table.userId, table.branchId, table.tenantId],
      name: 'user_branch_access_pkey',
    }),
    fkUbAccessUser: foreignKey({
      columns: [table.userId, table.tenantId],
      foreignColumns: [users.id, users.tenantId],
      name: 'fk_ub_access_user',
    }),
    fkUbAccessBranch: foreignKey({
      columns: [table.branchId, table.tenantId],
      foreignColumns: [branches.id, branches.tenantId],
      name: 'fk_ub_access_branch',
    }),
    idxUserBranchAccessTenantUser: uniqueIndex('idx_user_branch_access_tenant_user').on(table.tenantId, table.userId),
  }),
);

export const financialYears = pgTable(
  'financial_years',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id'),
    name: varchar('name', { length: 100 }).notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: fyStatusEnum('status').notNull().default('open'),
    isActive: boolean('is_active').notNull().default(false),
    isLocked: boolean('is_locked').notNull().default(false),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    version: integer('version').notNull().default(1),
  },
  (table) => ({
    fkFyBranchTenant: foreignKey({
      columns: [table.branchId, table.tenantId],
      foreignColumns: [branches.id, branches.tenantId],
      name: 'fk_financial_year_branch_tenant',
    }),
    uqFyIdTenant: uniqueIndex('uq_fy_id_tenant').on(table.id, table.tenantId),
    uqActiveFinancialYear: uniqueIndex('uq_active_financial_year')
      .on(table.tenantId)
      .where(sql`${table.isActive} = true AND ${table.isDeleted} = false`),
    idxFinancialYearTenantBranch: index('idx_financial_years_tenant_branch').on(table.tenantId, table.branchId),
    checkFinancialYearDates: check('check_financial_year_dates', sql`${table.startDate} < ${table.endDate}`),
    checkFySoftDelete: check(
      'check_fy_soft_delete',
      sql`(((${table.isDeleted}) = false AND (${table.deletedAt}) IS NULL) OR ((${table.isDeleted}) = true AND (${table.deletedAt}) IS NOT NULL))`,
    ),
    checkFyLockedStatus: check(
      'check_fy_locked_status',
      sql`NOT ((${table.isLocked}) = true AND (${table.status}) = 'open')`,
    ),
  }),
);

export const schema = {
  tenants,
  tenantSubscriptions,
  tenantModules,
  branches,
  inventoryWarehouses,
  users,
  userSessions,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  userPermissions,
  userBranchAccess,
  financialYears,
};

export * from './rls.js';

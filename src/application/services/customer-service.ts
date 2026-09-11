import { validate as isUuid } from 'uuid';

import type { AuditLogger } from '../contracts/audit.js';
import type { ModuleAccessService } from './module-access-service.js';
import type { AuthorizationService } from './authorization-service.js';
import {
  CUSTOMER_MODULE_CODE,
  CUSTOMER_PERMISSIONS,
  type CustomerPermission,
} from '../../domain/contracts/customer.js';
import type { CustomerListQuery, CustomerRecord, CustomerRepository } from '../../domain/contracts/repositories.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors.js';

export interface CustomerContext {
  tenantId: string;
  userId: string;
}

export interface CustomerTransactionRunner {
  runInTransaction<T>(callback: () => Promise<T>): Promise<T>;
}

export interface CustomerListInput {
  page?: number;
  pageSize?: number;
  order?: 'asc' | 'desc';
  search?: string;
}

export type CustomerInput = Record<string, unknown> & {
  name?: string;
  code?: string;
  shortName?: string;
  customerType?: string;
  customerCategory?: string;
  zone?: string;
  domesticExport?: string;
  inUse?: boolean;
  merchantExporter?: boolean;
  insurance?: boolean;
  nda?: boolean;
  startDate?: string | Date | null;
  expiryDate?: string | Date | null;
  address?: string;
  address1?: string;
  city?: string;
  pincode?: string;
  country?: string;
  state?: string;
  district?: string;
  panNo?: string;
  gstNo?: string;
  vatNo?: string;
  cstNo?: string;
  serviceTaxNo?: string;
  eccCode?: string;
  fax?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  contactPerson?: string;
  designation?: string;
  website?: string;
  interestPercent?: number;
  outstandingLimit?: number;
  agingLimit?: number;
  cashDiscountPercent?: number;
  supplierCode?: string;
  industryType?: string;
  discountApplicable?: boolean;
  bankName?: string;
  bankAddress?: string;
  bankAddress1?: string;
  bankAccountNo?: string;
  range?: string;
  commissionerate?: string;
  division?: string;
  referenceCustomer?: string;
  documentThrough?: string;
  dealerName?: string;
  dealerAddress?: string;
  dealerAddress1?: string;
  weeklyOff?: string;
  groupCustomer?: string;
  distanceInKm?: number;
  marketingBy?: string;
  salesmanName?: string;
  contacts?: Array<Record<string, unknown>>;
  officeDetails?: Record<string, unknown> | null;
  taxPaymentTerms?: Record<string, unknown> | null;
  otherDetails?: Record<string, unknown> | null;
  expectedVersion?: number;
};

export class CustomerService {
  constructor(
    private readonly repository: CustomerRepository,
    private readonly authorizationService: Pick<AuthorizationService, 'hasPermission'>,
    private readonly moduleAccessService: Pick<ModuleAccessService, 'isModuleEnabled'>,
    private readonly auditLogger: AuditLogger,
    private readonly transactionRunner: CustomerTransactionRunner,
  ) {}

  async create(context: CustomerContext, input: CustomerInput = {}): Promise<CustomerRecord> {
    await this.authorize(context, CUSTOMER_PERMISSIONS.create);
    const normalized = this.normalizeCustomerInput(input, 'create');
    return this.transactionRunner.runInTransaction(async () => {
      const customer = await this.repository.create({ ...context, ...normalized, actorUserId: context.userId });
      await this.auditLogger.record(
        {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: 'customer.created',
          resourceType: 'customer',
          resourceId: customer.id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return customer;
    });
  }

  async get(context: CustomerContext, customerId: string): Promise<CustomerRecord> {
    await this.authorize(context, CUSTOMER_PERMISSIONS.read);
    const id = this.validateId(customerId, 'Customer ID');
    const customer = await this.repository.getById(context.tenantId, id);
    if (!customer) throw new NotFoundError('Customer not found.');
    return customer;
  }

  async list(context: CustomerContext, input: CustomerListInput = {}) {
    await this.authorize(context, CUSTOMER_PERMISSIONS.read);
    const query: CustomerListQuery = {
      page: this.validatePage(input.page),
      pageSize: this.validatePageSize(input.pageSize),
      order: input.order ?? 'asc',
      search: this.validateSearch(input.search),
    };
    return this.repository.list(context.tenantId, query);
  }

  async update(context: CustomerContext, customerId: string, input: CustomerInput = {}): Promise<CustomerRecord> {
    await this.authorize(context, CUSTOMER_PERMISSIONS.update);
    const id = this.validateId(customerId, 'Customer ID');
    const normalized = this.normalizeCustomerInput(input, 'update');
    const expectedVersion = this.validateVersion(input.expectedVersion, 'Expected version');
    return this.transactionRunner.runInTransaction(async () => {
      const customer = await this.repository.update({
        ...context,
        customerId: id,
        ...normalized,
        expectedVersion,
        actorUserId: context.userId,
      });
      if (!customer) throw new NotFoundError('Customer not found or version is stale.');
      await this.auditLogger.record(
        {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: 'customer.updated',
          resourceType: 'customer',
          resourceId: customer.id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return customer;
    });
  }

  async softDelete(context: CustomerContext, customerId: string, expectedVersion?: number): Promise<CustomerRecord> {
    await this.authorize(context, CUSTOMER_PERMISSIONS.delete);
    const id = this.validateId(customerId, 'Customer ID');
    const version = this.validateVersion(expectedVersion, 'Expected version');
    return this.transactionRunner.runInTransaction(async () => {
      const customer = await this.repository.softDelete({
        ...context,
        customerId: id,
        actorUserId: context.userId,
        expectedVersion: version,
      });
      if (!customer) throw new NotFoundError('Customer not found or version is stale.');
      await this.auditLogger.record(
        {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: 'customer.deleted',
          resourceType: 'customer',
          resourceId: customer.id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return customer;
    });
  }

  private async authorize(context: CustomerContext, permission: CustomerPermission): Promise<void> {
    this.validateContext(context);
    const moduleEnabled = await this.moduleAccessService.isModuleEnabled(
      context.tenantId,
      CUSTOMER_MODULE_CODE,
    );
    if (!moduleEnabled) throw new ForbiddenError('Customer module is not enabled for this tenant.');
    if (!(await this.authorizationService.hasPermission(context.tenantId, context.userId, permission))) {
      throw new ForbiddenError('Insufficient permission for Customer operation.');
    }
  }

  private validateContext(context: CustomerContext): void {
    if (!context.userId?.trim()) throw new UnauthorizedError();
    this.validateId(context.tenantId, 'Tenant ID');
    this.validateId(context.userId, 'User ID');
  }

  private normalizeCustomerInput(input: CustomerInput, operation: 'create' | 'update'): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    const nameValue = this.asString(input.name);
    if (nameValue !== undefined) normalized.name = this.validateName(nameValue);
    else if (operation === 'create') {
      throw new ValidationError('Customer name is required.');
    }

    const code = this.asString(input.code);
    if (code !== undefined) normalized.code = this.validateCode(code);

    const supported = [
      'shortName','customerType','customerCategory','zone','domesticExport','inUse','merchantExporter','insurance','nda',
      'startDate','expiryDate','address','address1','city','pincode','country','state','district','panNo','gstNo','vatNo',
      'cstNo','serviceTaxNo','eccCode','fax','phone','mobile','email','contactPerson','designation','website',
      'interestPercent','outstandingLimit','agingLimit','cashDiscountPercent','supplierCode','industryType','discountApplicable',
      'bankName','bankAddress','bankAddress1','bankAccountNo','range','commissionerate','division','referenceCustomer',
      'documentThrough','dealerName','dealerAddress','dealerAddress1','weeklyOff','groupCustomer','distanceInKm','marketingBy','salesmanName'
    ] as const;

    for (const field of supported) {
      const value = input[field as keyof CustomerInput] as unknown;
      const normalizedValue = this.normalizeField(field, value);
      if (normalizedValue !== undefined) normalized[field] = normalizedValue;
    }

    if ('contacts' in input) {
      normalized.contacts = this.validateContactList(input.contacts);
    }
    if ('officeDetails' in input) {
      normalized.officeDetails = this.validateOfficeDetails(input.officeDetails);
    }
    if ('taxPaymentTerms' in input) {
      normalized.taxPaymentTerms = this.validateDetailObject(input.taxPaymentTerms, [
        'taxCategory',
        'paymentTerms',
        'creditDays',
        'taxRegistrationType',
      ]);
      if (normalized.taxPaymentTerms && Object.prototype.hasOwnProperty.call(normalized.taxPaymentTerms, 'creditDays')) {
        const creditDays = this.coerceNumber((normalized.taxPaymentTerms as Record<string, unknown>).creditDays, 'creditDays');
        if (!Number.isInteger(creditDays) || creditDays < 0) throw new ValidationError('creditDays must be a non-negative integer.');
        (normalized.taxPaymentTerms as Record<string, unknown>).creditDays = creditDays;
      }
    }
    if ('otherDetails' in input) {
      normalized.otherDetails = this.validateDetailObject(input.otherDetails, ['notes', 'reference', 'remarks']);
    }

    return normalized;
  }

  private normalizeField(field: string, value: unknown): unknown {
    if (value === undefined || value === null) return undefined;
    switch (field) {
      case 'inUse':
      case 'merchantExporter':
      case 'insurance':
      case 'nda':
      case 'discountApplicable':
        return this.coerceBoolean(value, field);
      case 'interestPercent':
      case 'outstandingLimit':
      case 'agingLimit':
      case 'cashDiscountPercent':
      case 'distanceInKm':
        return this.coerceNumber(value, field);
      case 'startDate':
      case 'expiryDate':
        return this.validateDate(value, field);
      case 'email':
        return this.validateEmail(this.asString(value, field));
      case 'code':
        return this.validateCode(this.asString(value, field));
      default:
        return this.asString(value, field) ?? value;
    }
  }

  private validateName(name: string): string {
    const normalized = name?.trim();
    if (!normalized) throw new ValidationError('Customer name is required.');
    if (normalized.length > 255) throw new ValidationError('Customer name must be 255 characters or fewer.');
    return normalized;
  }

  private validateCode(code: string | null | undefined): string | undefined {
    if (code === undefined || code === null || code === '') return undefined;
    const normalized = code.trim();
    if (!normalized) return undefined;
    if (normalized.length > 50) throw new ValidationError('Customer code must be 50 characters or fewer.');
    return normalized.toUpperCase();
  }

  private validateEmail(email: string | null | undefined): string | null | undefined {
    if (email === undefined || email === null || email === '') return undefined;
    const normalized = email.trim();
    if (!normalized) return undefined;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new ValidationError('Customer email is invalid.');
    }
    return normalized;
  }

  private validateDate(value: unknown, field: string): string | null | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim();
    if (!text) return undefined;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      throw new ValidationError(`${field} must be a valid date.`);
    }
    return text;
  }

  private validateContactList(value: unknown): Array<Record<string, unknown>> | undefined {
    if (value === undefined) return undefined;
    const list = Array.isArray(value) ? value : [value];
    if (list.length > 4) throw new ValidationError('Customer contacts must have at most four entries.');
    return list.map((item, index) => {
      const block = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const contactPerson = this.asString(block.contactPerson ?? block.name);
      const designation = this.asString(block.designation);
      const mobile = this.asString(block.mobile);
      const email = this.validateEmail(this.asString(block.email));
      if (!contactPerson && !designation && !mobile && !email) {
        return {} as Record<string, unknown>;
      }
      if ((contactPerson ?? '').length > 255) {
        throw new ValidationError(`Contact ${index + 1} person name must be 255 characters or fewer.`);
      }
      return {
        ...(contactPerson !== undefined ? { contactPerson } : {}),
        ...(designation !== undefined ? { designation } : {}),
        ...(mobile !== undefined ? { mobile } : {}),
        ...(email !== undefined ? { email } : {}),
      };
    }).filter((entry) => Object.keys(entry).length > 0);
  }

  private validateOfficeDetails(value: unknown): Record<string, unknown> | undefined {
    if (value === undefined || value === null) return undefined;
    const office = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const created: Record<string, unknown> = {};
    for (const field of ['name','address','address1','city','pincode','state','faxNo','phone','email','mobile','contact','designation','website','weeklyOff','panNo','gstNo'] as const) {
      const normalized = this.normalizeField(field, office[field]);
      if (normalized !== undefined) created[field] = normalized;
    }

    return Object.keys(created).length > 0 ? created : undefined;
  }

  private validateDetailObject(value: unknown, fields: readonly string[]): Record<string, unknown> | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('Customer detail sections must be objects.');
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      const normalized = this.normalizeField(field, (value as Record<string, unknown>)[field]);
      if (normalized !== undefined) result[field] = normalized;
    }
    return result;
  }

  private coerceBoolean(value: unknown, field: string): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
      if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    }
    if (typeof value === 'number') return value !== 0;
    throw new ValidationError(`${field} must be a boolean value.`);
  }

  private coerceNumber(value: unknown, field: string): number {
    const number = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isFinite(number)) throw new ValidationError(`${field} must be a valid number.`);
    return number;
  }

  private asString(value: unknown, field?: string): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const text = typeof value === 'string' ? value : String(value);
    if (field && text.length > 255) {
      throw new ValidationError(`${field} must be 255 characters or fewer.`);
    }
    return text.trim();
  }

  private validateVersion(value: unknown, label: string): number | undefined {
    if (value === undefined) return undefined;
    if (!Number.isInteger(Number(value)) || Number(value) < 1) {
      throw new ValidationError(`${label} must be a positive integer.`);
    }
    return Number(value);
  }

  private validateId(id: string, label: string): string {
    if (!id || !isUuid(id)) throw new ValidationError(`${label} must be a valid UUID.`);
    return id;
  }

  private validatePage(page = 1): number {
    if (!Number.isInteger(page) || page < 1) throw new ValidationError('Page must be a positive integer.');
    return page;
  }

  private validatePageSize(pageSize = 20): number {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ValidationError('Page size must be between 1 and 100.');
    }
    return pageSize;
  }

  private validateSearch(search?: string): string | undefined {
    if (search === undefined) return undefined;
    const normalized = search.trim();
    if (normalized.length > 100) throw new ValidationError('Search must be 100 characters or fewer.');
    return normalized || undefined;
  }
}

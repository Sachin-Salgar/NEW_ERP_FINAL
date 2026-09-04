import { validate as isUuid } from 'uuid';

import type { AuditLogger } from '../contracts/audit.js';
import type { ModuleAccessService } from './module-access-service.js';
import type { AuthorizationService } from './authorization-service.js';
import { CUSTOMER_MODULE_CODE, CUSTOMER_PERMISSIONS, type CustomerPermission } from '../../domain/contracts/customer.js';
import type { CustomerListQuery, CustomerRecord, CustomerRepository } from '../../domain/contracts/repositories.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors.js';

export interface CustomerContext {
  tenantId: string;
  organizationId: string;
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

export class CustomerService {
  constructor(
    private readonly repository: CustomerRepository,
    private readonly authorizationService: Pick<AuthorizationService, 'hasPermission'>,
    private readonly moduleAccessService: Pick<ModuleAccessService, 'isModuleEnabled'>,
    private readonly auditLogger: AuditLogger,
    private readonly transactionRunner: CustomerTransactionRunner,
  ) {}

  async create(context: CustomerContext, input: { name: string }): Promise<CustomerRecord> {
    await this.authorize(context, CUSTOMER_PERMISSIONS.create);
    const name = this.validateName(input.name);
    return this.transactionRunner.runInTransaction(async () => {
      const customer = await this.repository.create({ ...context, name, actorUserId: context.userId });
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
    const customer = await this.repository.getById(context.tenantId, context.organizationId, id);
    if (!customer) throw new NotFoundError('Customer not found.');
    return customer;
  }

  async list(context: CustomerContext, input: CustomerListInput = {}) {
    await this.authorize(context, CUSTOMER_PERMISSIONS.read);
    const query: CustomerListQuery = {
      organizationId: context.organizationId,
      page: this.validatePage(input.page),
      pageSize: this.validatePageSize(input.pageSize),
      order: input.order ?? 'asc',
      search: this.validateSearch(input.search),
    };
    return this.repository.list(context.tenantId, query);
  }

  async update(context: CustomerContext, customerId: string, input: { name: string }): Promise<CustomerRecord> {
    await this.authorize(context, CUSTOMER_PERMISSIONS.update);
    const id = this.validateId(customerId, 'Customer ID');
    const name = this.validateName(input.name);
    return this.transactionRunner.runInTransaction(async () => {
      const customer = await this.repository.update({
        ...context,
        customerId: id,
        name,
        actorUserId: context.userId,
      });
      if (!customer) throw new NotFoundError('Customer not found.');
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

  async softDelete(context: CustomerContext, customerId: string): Promise<CustomerRecord> {
    await this.authorize(context, CUSTOMER_PERMISSIONS.delete);
    const id = this.validateId(customerId, 'Customer ID');
    return this.transactionRunner.runInTransaction(async () => {
      const customer = await this.repository.softDelete({
        ...context,
        customerId: id,
        actorUserId: context.userId,
      });
      if (!customer) throw new NotFoundError('Customer not found.');
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
      context.organizationId,
      CUSTOMER_MODULE_CODE,
    );
    if (!moduleEnabled) throw new ForbiddenError('Customer module is not enabled for this organization.');
    if (!(await this.authorizationService.hasPermission(context.tenantId, context.userId, permission))) {
      throw new ForbiddenError('Insufficient permission for Customer operation.');
    }
  }

  private validateContext(context: CustomerContext): void {
    if (!context.userId?.trim()) throw new UnauthorizedError();
    this.validateId(context.tenantId, 'Tenant ID');
    this.validateId(context.organizationId, 'Organization ID');
    this.validateId(context.userId, 'User ID');
  }

  private validateName(name: string): string {
    const normalized = name?.trim();
    if (!normalized) throw new ValidationError('Customer name is required.');
    if (normalized.length > 255) throw new ValidationError('Customer name must be 255 characters or fewer.');
    return normalized;
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

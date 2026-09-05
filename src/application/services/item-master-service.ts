import { validate as isUuid } from 'uuid';

import type { AuditLogger } from '../contracts/audit.js';
import type { ModuleAccessService } from './module-access-service.js';
import type { AuthorizationService } from './authorization-service.js';
import {
  ITEM_MASTER_MODULE_CODE,
  ITEM_MASTER_PERMISSIONS,
  type ItemMasterPermission,
} from '../../domain/contracts/item-master.js';
import type { ItemRecord, ItemRepository } from '../../domain/contracts/repositories.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors.js';

export interface ItemMasterContext {
  tenantId: string;
  organizationId: string;
  userId: string;
}

export interface ItemMasterTransactionRunner {
  runInTransaction<T>(callback: () => Promise<T>): Promise<T>;
}

export class ItemMasterService {
  constructor(
    private readonly repository: ItemRepository,
    private readonly authorizationService: Pick<AuthorizationService, 'hasPermission'>,
    private readonly moduleAccessService: Pick<ModuleAccessService, 'isModuleEnabled'>,
    private readonly auditLogger: AuditLogger,
    private readonly transactionRunner: ItemMasterTransactionRunner,
  ) {}

  async create(
    context: ItemMasterContext,
    input: { code: string; name: string; description?: string | null; unitOfMeasure: string; salesEligible?: boolean },
  ): Promise<ItemRecord> {
    await this.authorize(context, ITEM_MASTER_PERMISSIONS.create);
    const normalized = this.validateInput(input);
    return this.transactionRunner.runInTransaction(async () => {
      const item = await this.repository.create({ ...context, ...normalized, code: normalized.code!, actorUserId: context.userId });
      await this.auditLogger.record(
        {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: 'inventory.item.created',
          resourceType: 'inventory_item',
          resourceId: item.id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return item;
    });
  }

  async get(context: ItemMasterContext, itemId: string): Promise<ItemRecord> {
    await this.authorize(context, ITEM_MASTER_PERMISSIONS.read);
    const id = this.validateId(itemId, 'Item ID');
    const item = await this.repository.getById(context.tenantId, context.organizationId, id);
    if (!item) throw new NotFoundError('Item not found.');
    return item;
  }

  async list(
    context: ItemMasterContext,
    input: { page?: number; pageSize?: number; order?: 'asc' | 'desc'; search?: string } = {},
  ): Promise<{ items: ItemRecord[]; total: number }> {
    await this.authorize(context, ITEM_MASTER_PERMISSIONS.read);
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    if (!Number.isInteger(page) || page < 1) throw new ValidationError('Page must be a positive integer.');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ValidationError('Page size must be between 1 and 100.');
    }
    return this.repository.list(context.tenantId, {
      ...input,
      organizationId: context.organizationId,
      page,
      pageSize,
      order: input.order ?? 'asc',
      search: input.search?.trim() || undefined,
    });
  }

  async update(
    context: ItemMasterContext,
    itemId: string,
    input: { name: string; description?: string | null; unitOfMeasure: string; salesEligible: boolean; expectedVersion: number },
  ): Promise<ItemRecord> {
    await this.authorize(context, ITEM_MASTER_PERMISSIONS.update);
    const id = this.validateId(itemId, 'Item ID');
    const normalized = this.validateInput(input);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
      throw new ValidationError('Expected version must be a positive integer.');
    }
    return this.transactionRunner.runInTransaction(async () => {
      const item = await this.repository.update({
        ...context,
        itemId: id,
        ...normalized,
        expectedVersion: input.expectedVersion,
        actorUserId: context.userId,
      });
      if (!item) throw new NotFoundError('Item not found or version is stale.');
      await this.auditLogger.record(
        {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: 'inventory.item.updated',
          resourceType: 'inventory_item',
          resourceId: item.id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return item;
    });
  }

  async softDelete(context: ItemMasterContext, itemId: string, expectedVersion: number): Promise<ItemRecord> {
    await this.authorize(context, ITEM_MASTER_PERMISSIONS.delete);
    const id = this.validateId(itemId, 'Item ID');
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new ValidationError('Expected version must be a positive integer.');
    }
    return this.transactionRunner.runInTransaction(async () => {
      const item = await this.repository.softDelete({
        ...context,
        itemId: id,
        expectedVersion,
        actorUserId: context.userId,
      });
      if (!item) throw new NotFoundError('Item not found or version is stale.');
      await this.auditLogger.record(
        {
          tenantId: context.tenantId,
          actorUserId: context.userId,
          action: 'inventory.item.deleted',
          resourceType: 'inventory_item',
          resourceId: item.id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return item;
    });
  }

  private async authorize(context: ItemMasterContext, permission: ItemMasterPermission): Promise<void> {
    this.validateContext(context);
    if (!(await this.moduleAccessService.isModuleEnabled(context.tenantId, context.organizationId, ITEM_MASTER_MODULE_CODE))) {
      throw new ForbiddenError('Inventory module is not enabled for this organization.');
    }
    if (!(await this.authorizationService.hasPermission(context.tenantId, context.userId, permission))) {
      throw new ForbiddenError('Insufficient permission for Item Master operation.');
    }
  }

  private validateContext(context: ItemMasterContext): void {
    if (!context.userId?.trim()) throw new UnauthorizedError();
    this.validateId(context.tenantId, 'Tenant ID');
    this.validateId(context.organizationId, 'Organization ID');
    this.validateId(context.userId, 'User ID');
  }

  private validateInput(input: {
    code?: string;
    name: string;
    description?: string | null;
    unitOfMeasure: string;
    salesEligible?: boolean;
  }) {
    const code = input.code?.trim().toUpperCase();
    const name = input.name?.trim();
    const unitOfMeasure = input.unitOfMeasure?.trim();
    if (!code && input.code !== undefined) throw new ValidationError('Item code is required.');
    if (code && code.length > 100) throw new ValidationError('Item code must be 100 characters or fewer.');
    if (!name) throw new ValidationError('Item name is required.');
    if (name.length > 255) throw new ValidationError('Item name must be 255 characters or fewer.');
    if (!unitOfMeasure) throw new ValidationError('Unit of measure is required.');
    if (unitOfMeasure.length > 50) throw new ValidationError('Unit of measure must be 50 characters or fewer.');
    const description = input.description?.trim() || null;
    if (description && description.length > 2000) throw new ValidationError('Item description must be 2000 characters or fewer.');
    return { ...(code ? { code } : {}), name, description, unitOfMeasure, salesEligible: input.salesEligible ?? true };
  }

  private validateId(id: string, label: string): string {
    if (!id || !isUuid(id)) throw new ValidationError(`${label} must be a valid UUID.`);
    return id;
  }
}

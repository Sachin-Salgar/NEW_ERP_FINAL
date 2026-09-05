import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { ItemMasterService } from '../../src/application/services/item-master-service.js';
import type { AuditLogger } from '../../src/application/contracts/audit.js';
import type { ItemRecord, ItemRepository } from '../../src/domain/contracts/repositories.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/domain/errors.js';

const context = { tenantId: randomUUID(), organizationId: randomUUID(), userId: randomUUID() };

function record(overrides: Partial<ItemRecord> = {}): ItemRecord {
  return {
    id: randomUUID(), tenantId: context.tenantId, organizationId: context.organizationId,
    code: 'SKU-1', name: 'Widget', description: null, unitOfMeasure: 'EA',
    salesEligible: true, status: 'ACTIVE', createdAt: new Date(), createdBy: context.userId,
    updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null, isDeleted: false, version: 1, ...overrides,
  };
}

class FakeRepository implements ItemRepository {
  item = record();
  async create() { return this.item; }
  async getById() { return this.item; }
  async list() { return { items: [this.item], total: 1 }; }
  async update(): Promise<ItemRecord | null> { return this.item; }
  async softDelete(): Promise<ItemRecord | null> { return record({ isDeleted: true, deletedAt: new Date(), deletedBy: context.userId }); }
}

class FakeAuditLogger implements AuditLogger {
  events: string[] = [];
  async record(event: { action: string }) { this.events.push(event.action); }
}

function createService(options: { permission?: boolean; moduleEnabled?: boolean } = {}) {
  const repository = new FakeRepository();
  const auditLogger = new FakeAuditLogger();
  const service = new ItemMasterService(
    repository,
    { hasPermission: async () => options.permission ?? true },
    { isModuleEnabled: async () => options.moduleEnabled ?? true },
    auditLogger,
    { runInTransaction: async (callback) => callback() },
  );
  return { service, repository, auditLogger };
}

describe('ItemMasterService', () => {
  it('creates, reads, lists, updates, and soft-deletes items with audit events', async () => {
    const { service, auditLogger } = createService();
    await expect(service.create(context, { code: ' sku-1 ', name: ' Widget ', unitOfMeasure: 'EA' })).resolves.toBeTruthy();
    await expect(service.get(context, randomUUID())).resolves.toBeTruthy();
    await expect(service.list(context, { page: 1, pageSize: 20, search: 'widget' })).resolves.toMatchObject({ total: 1 });
    await expect(service.update(context, randomUUID(), { name: 'Updated', unitOfMeasure: 'EA', salesEligible: true, expectedVersion: 1 })).resolves.toBeTruthy();
    await expect(service.softDelete(context, randomUUID(), 1)).resolves.toMatchObject({ isDeleted: true });
    expect(auditLogger.events).toEqual(['inventory.item.created', 'inventory.item.updated', 'inventory.item.deleted']);
  });

  it('rejects invalid item input and stale mutations', async () => {
    const { service, repository } = createService();
    await expect(service.create(context, { code: ' ', name: 'Widget', unitOfMeasure: 'EA' })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.get(context, 'invalid')).rejects.toBeInstanceOf(ValidationError);
    repository.update = async (): Promise<ItemRecord | null> => null;
    repository.softDelete = async (): Promise<ItemRecord | null> => null;
    await expect(service.update(context, randomUUID(), { name: 'Updated', unitOfMeasure: 'EA', salesEligible: true, expectedVersion: 1 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.softDelete(context, randomUUID(), 1)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('enforces the Inventory module and item permissions', async () => {
    await expect(createService({ moduleEnabled: false }).service.list(context, {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createService({ permission: false }).service.list(context, {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});

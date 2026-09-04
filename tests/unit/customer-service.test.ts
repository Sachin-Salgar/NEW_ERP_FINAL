import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { CustomerService } from '../../src/application/services/customer-service.js';
import type { AuditLogger } from '../../src/application/contracts/audit.js';
import type { CustomerRecord, CustomerRepository } from '../../src/domain/contracts/repositories.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/domain/errors.js';

const context = {
  tenantId: randomUUID(),
  organizationId: randomUUID(),
  userId: randomUUID(),
};

function record(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    id: randomUUID(),
    tenantId: context.tenantId,
    organizationId: context.organizationId,
    name: 'Acme',
    createdAt: new Date(),
    createdBy: context.userId,
    updatedAt: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
    isDeleted: false,
    version: 1,
    ...overrides,
  };
}

class FakeRepository implements CustomerRepository {
  customer = record();
  async create() {
    return this.customer;
  }
  async getById() {
    return this.customer;
  }
  async list() {
    return { items: [this.customer], total: 1 };
  }
  async update(): Promise<CustomerRecord | null> {
    return this.customer;
  }
  async softDelete(): Promise<CustomerRecord | null> {
    return record({ isDeleted: true, deletedAt: new Date(), deletedBy: context.userId });
  }
}

class FakeAuditLogger implements AuditLogger {
  events: string[] = [];
  async record(event: { action: string }) {
    this.events.push(event.action);
  }
}

function createService(options: { permission?: boolean; moduleEnabled?: boolean } = {}) {
  const repository = new FakeRepository();
  const auditLogger = new FakeAuditLogger();
  const service = new CustomerService(
    repository,
    { hasPermission: async () => options.permission ?? true },
    { isModuleEnabled: async () => options.moduleEnabled ?? true },
    auditLogger,
    { runInTransaction: async (callback) => callback() },
  );
  return { service, repository, auditLogger };
}

describe('CustomerService', () => {
  it('creates, updates, lists, and soft-deletes customers with audit events', async () => {
    const { service, auditLogger } = createService();

    await expect(service.create(context, { name: '  Acme  ' })).resolves.toBeTruthy();
    await expect(service.get(context, randomUUID())).resolves.toBeTruthy();
    await expect(service.list(context, { page: 1, pageSize: 20, search: 'Acme' })).resolves.toMatchObject({ total: 1 });
    await expect(service.update(context, randomUUID(), { name: 'Acme Updated' })).resolves.toBeTruthy();
    await expect(service.softDelete(context, randomUUID())).resolves.toMatchObject({ isDeleted: true });

    expect(auditLogger.events).toEqual(['customer.created', 'customer.updated', 'customer.deleted']);
  });

  it('rejects invalid names, identifiers, and pagination', async () => {
    const { service } = createService();

    await expect(service.create(context, { name: ' ' })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.get(context, 'not-a-uuid')).rejects.toBeInstanceOf(ValidationError);
    await expect(service.list(context, { pageSize: 101 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('enforces module access and customer permissions', async () => {
    await expect(createService({ moduleEnabled: false }).service.list(context)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createService({ permission: false }).service.list(context)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('does not silently accept missing records during update or delete', async () => {
    const { service, repository } = createService();
    repository.update = async () => null;
    repository.softDelete = async () => null;

    await expect(service.update(context, randomUUID(), { name: 'Updated' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.softDelete(context, randomUUID())).rejects.toBeInstanceOf(NotFoundError);
  });
});

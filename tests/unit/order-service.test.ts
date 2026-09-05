import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { OrderService, type OrderContext } from '../../src/application/services/order-service.js';
import type { AuditLogger } from '../../src/application/contracts/audit.js';
import type { OrderRecord, OrderRepository } from '../../src/domain/contracts/repositories.js';
import { ForbiddenError, ValidationError } from '../../src/domain/errors.js';

const context: OrderContext = {
  tenantId: randomUUID(),
  organizationId: randomUUID(),
  branchId: randomUUID(),
  financialYearId: randomUUID(),
  userId: randomUUID(),
};

function record(status: OrderRecord['status'] = 'DRAFT'): OrderRecord {
  return {
    id: randomUUID(),
    ...context,
    orderNumber: 'SO-000001',
    customerId: randomUUID(),
    quotationId: randomUUID(),
    status,
    notes: null,
    items: [],
    createdAt: new Date(),
    createdBy: context.userId,
    updatedAt: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
    isDeleted: false,
    versionNumber: 1,
  };
}

class FakeRepository implements OrderRepository {
  value = record();
  lastTransition?: { status: OrderRecord['status']; expectedVersion: number };
  async create() {
    return this.value;
  }
  async getById() {
    return this.value;
  }
  async list() {
    return { items: [this.value], total: 1 };
  }
  async update() {
    return this.value;
  }
  async transition(input: { status: OrderRecord['status']; expectedVersion: number }) {
    this.lastTransition = input;
    this.value = { ...this.value, status: input.status, versionNumber: input.expectedVersion + 1 };
    return this.value;
  }
  async softDelete() {
    this.value = { ...this.value, isDeleted: true, deletedAt: new Date() };
    return this.value;
  }
}

class Audit implements AuditLogger {
  actions: string[] = [];
  async record(event: { action: string }) {
    this.actions.push(event.action);
  }
}

function createService(options: { permission?: boolean; module?: boolean } = {}) {
  const repository = new FakeRepository();
  const audit = new Audit();
  return {
    repository,
    audit,
    service: new OrderService(
      repository,
      { hasPermission: async () => options.permission ?? true },
      { isModuleEnabled: async () => options.module ?? true },
      audit,
      { runInTransaction: async <T>(callback: () => Promise<T>) => callback() },
    ),
  };
}

describe('OrderService', () => {
  it('creates orders only from a quotation reference and audits the mutation', async () => {
    const { service, audit } = createService();
    await expect(service.create(context, { quotationId: randomUUID() })).resolves.toBeTruthy();
    expect(audit.actions).toEqual(['order.created']);
  });

  it('enforces lifecycle transitions and optimistic version checks', async () => {
    const { service, repository, audit } = createService();
    await expect(service.transition(context, repository.value.id, 'CONFIRMED', 1)).resolves.toMatchObject({
      status: 'CONFIRMED',
      versionNumber: 2,
    });
    expect(repository.lastTransition).toMatchObject({ status: 'CONFIRMED', expectedVersion: 1 });
    expect(audit.actions).toEqual(['order.confirmed']);

    repository.value = record('CONFIRMED');
    await expect(service.transition(context, repository.value.id, 'CONFIRMED', 1)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('rejects invalid transition versions and forbidden access', async () => {
    const { service, repository } = createService();
    await expect(service.transition(context, repository.value.id, 'CONFIRMED', 0)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      createService({ permission: false }).service.list(context, { page: 1, pageSize: 20, order: 'asc' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      createService({ module: false }).service.list(context, { page: 1, pageSize: 20, order: 'asc' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

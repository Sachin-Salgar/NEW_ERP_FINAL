import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DeliveryService, type DeliveryContext } from '../../src/application/services/delivery-service.js';
import type { AuditLogger } from '../../src/application/contracts/audit.js';
import type { DeliveryRecord, DeliveryRepository } from '../../src/domain/contracts/repositories.js';
import { ValidationError } from '../../src/domain/errors.js';

const context: DeliveryContext = { tenantId: randomUUID(), organizationId: randomUUID(), branchId: randomUUID(), financialYearId: randomUUID(), userId: randomUUID() };
function record(status: DeliveryRecord['status'] = 'DRAFT'): DeliveryRecord {
  return { id: randomUUID(), ...context, deliveryNumber: 'DEL-000001', salesOrderId: randomUUID(), customerId: randomUUID(), status, idempotencyKey: 'key', notes: null, items: [], createdAt: new Date(), createdBy: context.userId, updatedAt: null, updatedBy: null, versionNumber: 1 };
}
class FakeRepository implements DeliveryRepository {
  value = record();
  async create() { return this.value; }
  async getById() { return this.value; }
  async list() { return { items: [this.value], total: 1 }; }
  async update() { return this.value; }
  async transition(input: { status: DeliveryRecord['status']; expectedVersion: number }) { this.value = { ...this.value, status: input.status, versionNumber: input.expectedVersion + 1 }; return this.value; }
}
class Audit implements AuditLogger { actions: string[] = []; async record(event: { action: string }) { this.actions.push(event.action); } }
function createService() { const repository = new FakeRepository(); const audit = new Audit(); return { repository, audit, service: new DeliveryService(repository, { hasPermission: async () => true }, { isModuleEnabled: async () => true }, audit, { runInTransaction: async <T>(callback: () => Promise<T>) => callback() }) }; }

describe('DeliveryService', () => {
  it('creates and audits an idempotent delivery request', async () => {
    const { service, audit } = createService();
    await expect(service.create(context, { salesOrderId: randomUUID(), idempotencyKey: 'request-1' })).resolves.toBeTruthy();
    expect(audit.actions).toEqual(['delivery.created']);
  });
  it('rejects invalid lifecycle transitions', async () => {
    const { service, repository } = createService();
    repository.value = record('COMPLETED');
    await expect(service.transition(context, repository.value.id, 'CANCELLED', 1)).rejects.toBeInstanceOf(ValidationError);
  });
});

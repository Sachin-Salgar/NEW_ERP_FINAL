import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SalesReturnService, type SalesReturnContext } from '../../src/application/services/sales-return-service.js';
import type { AuditLogger } from '../../src/application/contracts/audit.js';
import type { SalesReturnRecord, SalesReturnRepository } from '../../src/domain/contracts/repositories.js';
import { ValidationError } from '../../src/domain/errors.js';

const context: SalesReturnContext = { tenantId: randomUUID(), organizationId: randomUUID(), branchId: randomUUID(), financialYearId: randomUUID(), userId: randomUUID() };
function record(status: SalesReturnRecord['status'] = 'REQUESTED'): SalesReturnRecord {
  return { id: randomUUID(), ...context, returnNumber: 'RET-000001', invoiceId: randomUUID(), deliveryId: randomUUID(), customerId: randomUUID(), status, idempotencyKey: 'key', inventoryStatus: 'NOT_CONNECTED', financeStatus: 'NOT_CONNECTED', notes: null, items: [], createdAt: new Date(), createdBy: context.userId, updatedAt: null, updatedBy: null, versionNumber: 1 };
}
class FakeRepository implements SalesReturnRepository {
  value = record();
  async create() { return this.value; }
  async getById() { return this.value; }
  async list() { return { items: [this.value], total: 1 }; }
  async update() { return this.value; }
  async transition(input: { status: SalesReturnRecord['status']; expectedVersion: number }) { this.value = { ...this.value, status: input.status, versionNumber: input.expectedVersion + 1 }; return this.value; }
}
class Audit implements AuditLogger { actions: string[] = []; async record(event: { action: string }) { this.actions.push(event.action); } }
function createService() { const repository = new FakeRepository(); const audit = new Audit(); return { repository, audit, service: new SalesReturnService(repository, { hasPermission: async () => true }, { isModuleEnabled: async () => true }, audit, { runInTransaction: async <T>(callback: () => Promise<T>) => callback() }) }; }

describe('SalesReturnService', () => {
  it('creates and audits a return coordination record', async () => {
    const { service, audit } = createService();
    await expect(service.create(context, { invoiceId: randomUUID(), idempotencyKey: 'request-1' })).resolves.toMatchObject({ inventoryStatus: 'NOT_CONNECTED', financeStatus: 'NOT_CONNECTED' });
    expect(audit.actions).toEqual(['sales_return.created']);
  });
  it('rejects an invalid lifecycle transition', async () => {
    const { service, repository } = createService();
    repository.value = record('CLOSED');
    await expect(service.transition(context, repository.value.id, 'CANCELLED', 1)).rejects.toBeInstanceOf(ValidationError);
  });
});

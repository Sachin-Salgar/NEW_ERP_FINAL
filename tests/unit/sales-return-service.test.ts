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
  async process(input: { expectedVersion: number }) { this.value = { ...this.value, status: 'PROCESSED', inventoryStatus: 'COMPLETED', versionNumber: input.expectedVersion + 1 }; return this.value; }
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
  it('rejects duplicate or non-positive requested quantities', async () => {
    const { service } = createService();
    const invoiceItemId = randomUUID();
    await expect(service.create(context, {
      invoiceId: randomUUID(),
      idempotencyKey: 'request-2',
      items: [
        { invoiceItemId, quantity: 1 },
        { invoiceItemId, quantity: 2 },
      ],
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.create(context, {
      invoiceId: randomUUID(),
      idempotencyKey: 'request-3',
      items: [{ invoiceItemId: randomUUID(), quantity: 0 }],
    })).rejects.toBeInstanceOf(ValidationError);
  });
  it('processes an approved return through one atomic repository operation', async () => {
    const { service, repository, audit } = createService();
    repository.value = { ...record('APPROVED'), warehouseId: randomUUID(), items: [{ id: randomUUID(), lineNumber: 1, invoiceItemId: randomUUID(), description: 'Item', quantity: 1, unitOfMeasure: 'EA', unitPrice: 2, itemId: randomUUID(), warehouseId: repository.value.warehouseId }] };
    const calls: string[] = [];
    const inventory = { listReservationsBySource: async () => [], fulfillReservationsBySource: async () => [], reserveStock: async () => { throw new Error('unused'); }, releaseReservation: async () => { throw new Error('unused'); }, fulfillReservation: async () => { throw new Error('unused'); }, returnStock: async (_context: SalesReturnContext, request: { warehouseId: string; itemId: string; quantity: number; sourceType: string; sourceId: string; idempotencyKey: string }) => { calls.push('return'); return { id: randomUUID(), tenantId: context.tenantId, organizationId: context.organizationId, branchId: context.branchId, financialYearId: context.financialYearId, warehouseId: request.warehouseId, itemId: request.itemId, movementType: 'RETURN' as const, quantity: request.quantity, sourceType: request.sourceType, sourceId: request.sourceId, operationKey: request.idempotencyKey, createdAt: new Date(), createdBy: context.userId }; } };
    const withInventory = new SalesReturnService(repository, { hasPermission: async () => true }, { isModuleEnabled: async () => true }, audit, { runInTransaction: async <T>(callback: () => Promise<T>) => callback() }, inventory);
    await expect(withInventory.transition(context, repository.value.id, 'PROCESSED', 1)).resolves.toMatchObject({ status: 'PROCESSED', inventoryStatus: 'COMPLETED', versionNumber: 2 });
    expect(calls).toEqual(['return']);
    expect(audit.actions).toContain('sales_return.processed');
  });
});

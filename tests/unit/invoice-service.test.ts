import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InvoiceService, type InvoiceContext } from '../../src/application/services/invoice-service.js';
import type { AuditLogger } from '../../src/application/contracts/audit.js';
import type { InvoiceRecord, InvoiceRepository } from '../../src/domain/contracts/repositories.js';
import { ValidationError } from '../../src/domain/errors.js';

const context: InvoiceContext = { tenantId: randomUUID(), organizationId: randomUUID(), branchId: randomUUID(), financialYearId: randomUUID(), userId: randomUUID() };
function record(status: InvoiceRecord['status'] = 'DRAFT'): InvoiceRecord {
  return { id: randomUUID(), ...context, invoiceNumber: 'INV-000001', salesOrderId: randomUUID(), deliveryId: randomUUID(), customerId: randomUUID(), status, idempotencyKey: 'key', financeStatus: 'NOT_CONNECTED', taxStatus: 'NOT_CONNECTED', financeReference: null, taxReference: null, notes: null, items: [], createdAt: new Date(), createdBy: context.userId, updatedAt: null, updatedBy: null, versionNumber: 1 };
}
class FakeRepository implements InvoiceRepository {
  value = record();
  async create() { return this.value; }
  async getById() { return this.value; }
  async list() { return { items: [this.value], total: 1 }; }
  async update() { return this.value; }
  async transition(input: { status: InvoiceRecord['status']; expectedVersion: number }) { this.value = { ...this.value, status: input.status, versionNumber: input.expectedVersion + 1 }; return this.value; }
}
class Audit implements AuditLogger { actions: string[] = []; async record(event: { action: string }) { this.actions.push(event.action); } }
function createService() { const repository = new FakeRepository(); const audit = new Audit(); return { repository, audit, service: new InvoiceService(repository, { hasPermission: async () => true }, { isModuleEnabled: async () => true }, audit, { runInTransaction: async <T>(callback: () => Promise<T>) => callback() }) }; }

describe('InvoiceService', () => {
  it('creates an invoice and records the Finance/Tax boundary state', async () => {
    const { service, audit } = createService();
    await expect(service.create(context, { deliveryId: randomUUID(), idempotencyKey: 'request-1' })).resolves.toMatchObject({ financeStatus: 'NOT_CONNECTED', taxStatus: 'NOT_CONNECTED' });
    expect(audit.actions).toEqual(['invoice.created']);
  });
  it('rejects transitions from an issued invoice', async () => {
    const { service, repository } = createService();
    repository.value = record('ISSUED');
    await expect(service.transition(context, repository.value.id, 'CANCELLED', 1)).rejects.toBeInstanceOf(ValidationError);
  });
});

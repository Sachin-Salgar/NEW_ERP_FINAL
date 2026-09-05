import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CreditNoteService, type CreditNoteContext } from '../../src/application/services/credit-note-service.js';
import type { AuditLogger } from '../../src/application/contracts/audit.js';
import type { CreditNoteRecord, CreditNoteRepository } from '../../src/domain/contracts/repositories.js';
import { ValidationError } from '../../src/domain/errors.js';

const context: CreditNoteContext = { tenantId: randomUUID(), organizationId: randomUUID(), branchId: randomUUID(), financialYearId: randomUUID(), userId: randomUUID() };
function record(status: CreditNoteRecord['status'] = 'DRAFT'): CreditNoteRecord {
  return { id: randomUUID(), ...context, creditNoteNumber: 'CN-000001', returnId: randomUUID(), invoiceId: randomUUID(), customerId: randomUUID(), status, idempotencyKey: 'key', financeStatus: 'NOT_CONNECTED', taxStatus: 'NOT_CONNECTED', notes: null, items: [], createdAt: new Date(), createdBy: context.userId, updatedAt: null, updatedBy: null, versionNumber: 1 };
}
class FakeRepository implements CreditNoteRepository {
  value = record();
  async create() { return this.value; }
  async getById() { return this.value; }
  async list() { return { items: [this.value], total: 1 }; }
  async update() { return this.value; }
  async transition(input: { status: CreditNoteRecord['status']; expectedVersion: number }) { this.value = { ...this.value, status: input.status, versionNumber: input.expectedVersion + 1 }; return this.value; }
}
class Audit implements AuditLogger { actions: string[] = []; async record(event: { action: string }) { this.actions.push(event.action); } }
function createService() { const repository = new FakeRepository(); const audit = new Audit(); return { repository, audit, service: new CreditNoteService(repository, { hasPermission: async () => true }, { isModuleEnabled: async () => true }, audit, { runInTransaction: async <T>(callback: () => Promise<T>) => callback() }) }; }

describe('CreditNoteService', () => {
  it('creates and audits a not-connected credit note', async () => {
    const { service, audit } = createService();
    await expect(service.create(context, { returnId: randomUUID(), idempotencyKey: 'request-1' })).resolves.toMatchObject({ financeStatus: 'NOT_CONNECTED', taxStatus: 'NOT_CONNECTED' });
    expect(audit.actions).toEqual(['credit_note.created']);
  });
  it('rejects transitions from an issued credit note', async () => {
    const { service, repository } = createService();
    repository.value = record('ISSUED');
    await expect(service.transition(context, repository.value.id, 'CANCELLED', 1)).rejects.toBeInstanceOf(ValidationError);
  });
});

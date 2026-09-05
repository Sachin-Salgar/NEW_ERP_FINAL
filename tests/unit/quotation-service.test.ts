import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { QuotationService } from '../../src/application/services/quotation-service.js';
import type { AuditLogger } from '../../src/application/contracts/audit.js';
import type {
  QuotationRepository,
  QuotationRecord,
  QuotationItemInput,
} from '../../src/domain/contracts/repositories.js';
import { ForbiddenError, ValidationError } from '../../src/domain/errors.js';

const context = {
  tenantId: randomUUID(),
  organizationId: randomUUID(),
  branchId: randomUUID(),
  financialYearId: randomUUID(),
  userId: randomUUID(),
};
const item: QuotationItemInput = { description: 'Service', quantity: 2, unitPrice: 10, unitOfMeasure: 'hour' };
function record(status: QuotationRecord['status'] = 'DRAFT'): QuotationRecord {
  return {
    id: randomUUID(),
    ...context,
    quotationNumber: 'Q-000001',
    customerId: randomUUID(),
    quotationDate: new Date('2026-01-01'),
    validUntil: new Date('2026-01-31'),
    status,
    notes: null,
    items: [{ id: randomUUID(), lineNumber: 1, ...item }],
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
class FakeRepository implements QuotationRepository {
  value = record();
  lastStatus?: string;
  deleted = false;
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
  async transition(input: { status: string }) {
    this.lastStatus = input.status;
    this.value = record(input.status as QuotationRecord['status']);
    return this.value;
  }
  async softDelete() {
    this.deleted = true;
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
    service: new QuotationService(
      repository,
      { hasPermission: async () => options.permission ?? true },
      { isModuleEnabled: async () => options.module ?? true },
      audit,
      { runInTransaction: async <T>(callback: () => Promise<T>) => callback() },
    ),
  };
}
const input = { customerId: randomUUID(), quotationDate: '2026-01-01', validUntil: '2026-01-31', items: [item] };

describe('QuotationService', () => {
  it('validates required item unit of measure', async () => {
    const { service } = createService();
    await expect(service.create(context, { ...input, items: [{ ...item, unitOfMeasure: '' }] })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
  it('enforces lifecycle transitions and audits them', async () => {
    const { service: sut, repository, audit } = createService();
    await sut.transition(context, repository.value.id, 'SENT');
    expect(repository.lastStatus).toBe('SENT');
    expect(audit.actions).toEqual(['quotation.sent']);
    await expect(sut.transition(context, repository.value.id, 'ACCEPTED')).resolves.toBeTruthy();
    await expect(sut.transition(context, repository.value.id, 'CANCELLED')).rejects.toBeInstanceOf(ValidationError);
  });
  it('separates draft DELETE from lifecycle CANCEL', async () => {
    const { service: sut, repository, audit } = createService();
    await expect(sut.delete(context, repository.value.id)).resolves.toMatchObject({ isDeleted: true });
    expect(repository.deleted).toBe(true);
    expect(repository.lastStatus).toBeUndefined();
    expect(audit.actions).toEqual(['quotation.deleted']);

    const cancelService = createService();
    await cancelService.service.transition(context, cancelService.repository.value.id, 'CANCELLED');
    expect(cancelService.repository.lastStatus).toBe('CANCELLED');
    expect(cancelService.audit.actions).toEqual(['quotation.cancelled']);
  });
  it.each(['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'] as const)(
    'rejects DELETE for %s quotations',
    async (status) => {
      const { service: sut, repository } = createService();
      repository.value = record(status);
      await expect(sut.delete(context, repository.value.id)).rejects.toMatchObject({
        message: 'Only draft quotations can be deleted.',
      });
      expect(repository.deleted).toBe(false);
    },
  );
  it.each([
    ['DRAFT', 'SENT'],
    ['DRAFT', 'CANCELLED'],
    ['SENT', 'ACCEPTED'],
    ['SENT', 'REJECTED'],
    ['SENT', 'EXPIRED'],
    ['SENT', 'CANCELLED'],
  ] as const)('allows %s -> %s', async (from, to) => {
    const { service: sut, repository } = createService();
    repository.value = record(from);
    await expect(sut.transition(context, repository.value.id, to)).resolves.toMatchObject({ status: to });
  });
  it.each(['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'] as const)(
    'rejects terminal %s transitions',
    async (status) => {
      const { service: sut, repository } = createService();
      repository.value = record(status);
      await expect(sut.transition(context, repository.value.id, 'CANCELLED')).rejects.toBeInstanceOf(ValidationError);
    },
  );
  it('enforces module and permission gates', async () => {
    await expect(
      createService({ module: false }).service.list(context, { page: 1, pageSize: 20, order: 'asc' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      createService({ permission: false }).service.list(context, { page: 1, pageSize: 20, order: 'asc' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

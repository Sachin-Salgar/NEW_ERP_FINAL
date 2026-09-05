import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PricingService, type PricingContext } from '../../src/application/services/pricing-service.js';
import type { AuditLogger } from '../../src/application/contracts/audit.js';
import type { PriceListRecord, PriceListRepository } from '../../src/domain/contracts/pricing.js';
import { ForbiddenError, ValidationError } from '../../src/domain/errors.js';

const context: PricingContext = { tenantId: randomUUID(), organizationId: randomUUID(), userId: randomUUID() };
const record: PriceListRecord = { id: randomUUID(), tenantId: context.tenantId, organizationId: context.organizationId, branchId: null, code: 'STD', name: 'Standard', currency: 'INR', effectiveFrom: '2026-01-01', effectiveTo: null, status: 'DRAFT', versionNumber: 1, items: [], createdAt: new Date(), updatedAt: null };
class Repository implements PriceListRepository {
  async create() { return record; } async getById() { return record; } async list() { return [record]; }
  async addItem() { return { id: randomUUID(), priceListId: record.id, itemCode: 'ITEM-1', unitOfMeasure: 'EA', price: 10, effectiveFrom: '2026-01-01', effectiveTo: null, versionNumber: 1 }; }
  async resolvePrice() { return null; } async update() { return record; } async transition() { return { ...record, status: 'PUBLISHED' as const, versionNumber: 2 }; }
}
class Audit implements AuditLogger { actions: string[] = []; async record(event: { action: string }) { this.actions.push(event.action); } }
const service = (permission = true, enabled = true) => { const audit = new Audit(); return { audit, value: new PricingService(new Repository(), { hasPermission: async () => permission }, { isModuleEnabled: async () => enabled }, audit) }; };

describe('PricingService', () => {
  it('creates, audits, and validates price lists', async () => {
    const x = service(); await expect(x.value.create(context, { code: 'STD', name: 'Standard', currency: 'INR', effectiveFrom: '2026-01-01' })).resolves.toBe(record); expect(x.audit.actions).toEqual(['pricing.created']);
  });
  it('rejects invalid item prices and denied access', async () => {
    const x = service(false); await expect(x.value.create(context, { code: 'STD', name: 'Standard', currency: 'INR', effectiveFrom: '2026-01-01' })).rejects.toBeInstanceOf(ForbiddenError);
    const y = service(); await expect(y.value.addItem(context, record.id, { itemCode: 'ITEM-1', unitOfMeasure: 'EA', price: -1, effectiveFrom: '2026-01-01' })).rejects.toBeInstanceOf(ValidationError);
  });
  it('enforces module access', async () => { await expect(service(true, false).value.list(context)).rejects.toBeInstanceOf(ForbiddenError); });
});

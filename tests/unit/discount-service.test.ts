import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DiscountService, type DiscountContext } from '../../src/application/services/discount-service.js';
import type { AuditLogger } from '../../src/application/contracts/audit.js';
import type { DiscountRuleRecord, DiscountRuleRepository } from '../../src/domain/contracts/discount.js';
import { ForbiddenError, ValidationError } from '../../src/domain/errors.js';

const context: DiscountContext = { tenantId: randomUUID(), organizationId: randomUUID(), userId: randomUUID() };
const record: DiscountRuleRecord = { id: randomUUID(), tenantId: context.tenantId, organizationId: context.organizationId, code: 'DISC10', name: 'Ten percent', percentage: 10, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'DRAFT', versionNumber: 1, createdAt: new Date(), updatedAt: null };
class Repository implements DiscountRuleRepository { async create() { return record; } async list() { return [record]; } async resolve() { return null; } async update() { return record; } async transition() { return { ...record, status: 'PUBLISHED' as const, versionNumber: 2 }; } }
class Audit implements AuditLogger { actions: string[] = []; async record(event: { action: string }) { this.actions.push(event.action); } }
const service = (permission = true, enabled = true) => { const audit = new Audit(); return { audit, value: new DiscountService(new Repository(), { hasPermission: async () => permission }, { isModuleEnabled: async () => enabled }, audit) }; };

describe('DiscountService', () => {
  it('validates and audits a discount rule', async () => { const x = service(); await expect(x.value.create(context, { code: 'DISC10', name: 'Ten percent', percentage: 10, effectiveFrom: '2026-01-01' })).resolves.toBe(record); expect(x.audit.actions).toEqual(['discount.created']); });
  it('rejects invalid percentages and denied access', async () => { await expect(service().value.create(context, { code: 'BAD', name: 'Bad', percentage: 101, effectiveFrom: '2026-01-01' })).rejects.toBeInstanceOf(ValidationError); await expect(service(false).value.list(context)).rejects.toBeInstanceOf(ForbiddenError); });
  it('audits publication', async () => { const x = service(); await x.value.transition(context, record.id, 'PUBLISHED', 1); expect(x.audit.actions).toEqual(['discount.published']); });
});

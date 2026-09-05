import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TaxService } from '../../src/application/services/tax-service.js';
import type { TaxRepository, TaxRuleRecord } from '../../src/domain/contracts/tax.js';
import type { AuditLogger } from '../../src/application/contracts/audit.js';
import { ForbiddenError, NotFoundError } from '../../src/domain/errors.js';

const context = { tenantId: randomUUID(), organizationId: randomUUID(), userId: randomUUID() };
const rule: TaxRuleRecord = { id: randomUUID(), ...context, code: 'GST', name: 'Standard', rate: 18, status: 'ACTIVE', effectiveFrom: '2026-01-01', effectiveTo: null, versionNumber: 1, createdAt: new Date(), updatedAt: null };
class Repository implements TaxRepository {
  async create() { return rule; }
  async list() { return [rule]; }
  async update() { return rule; }
  async setStatus() { return rule; }
  async resolve(): Promise<TaxRuleRecord | null> { return rule; }
}
class MissingRepository extends Repository { override async resolve() { return null; } }
class Audit implements AuditLogger { async record() {} }
const service = (permission = true, enabled = true) => new TaxService(new Repository(), { hasPermission: async () => permission }, { isModuleEnabled: async () => enabled }, new Audit());

describe('TaxService', () => {
  it('resolves deterministic tax amounts', async () => {
    await expect(service().calculate(context, { amount: 100, asOf: '2026-09-05' })).resolves.toMatchObject({ rate: 18, taxAmount: 18 });
  });
  it('rejects missing effective rules and denied access', async () => {
    const denied = service(false);
    await expect(denied.list(context)).rejects.toBeInstanceOf(ForbiddenError);
    const missing = new TaxService(new MissingRepository(), { hasPermission: async () => true }, { isModuleEnabled: async () => true }, new Audit());
    await expect(missing.calculate(context, { amount: 10, asOf: '2026-09-05' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

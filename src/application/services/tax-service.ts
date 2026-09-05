import { validate as isUuid } from 'uuid';
import type { AuditLogger } from '../contracts/audit.js';
import type { AuthorizationService } from './authorization-service.js';
import type { ModuleAccessService } from './module-access-service.js';
import type { TaxContext, TaxRepository, TaxResolution, TaxRuleRecord, TaxStatus } from '../../domain/contracts/tax.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors.js';

export class TaxService {
  constructor(
    private readonly repository: TaxRepository,
    private readonly auth: Pick<AuthorizationService, 'hasPermission'>,
    private readonly modules: Pick<ModuleAccessService, 'isModuleEnabled'>,
    private readonly audit: AuditLogger,
  ) {}

  async create(c: TaxContext, input: { code: string; name: string; rate: number; effectiveFrom: string; effectiveTo?: string | null }): Promise<TaxRuleRecord> {
    await this.authorize(c, 'tax.configuration.create');
    if (!input.code?.trim() || !input.name?.trim() || !Number.isFinite(input.rate) || input.rate < 0 || input.rate > 100 || !input.effectiveFrom)
      throw new ValidationError('Code, name, rate between 0 and 100, and effective date are required.');
    const value = await this.repository.create({ ...c, code: input.code.trim(), name: input.name.trim(), rate: input.rate, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null });
    await this.audit.record({ tenantId: c.tenantId, actorUserId: c.userId, action: 'tax.created', resourceType: 'tax_rule', resourceId: value.id, outcome: 'success' });
    return value;
  }

  async list(c: TaxContext) { await this.authorize(c, 'tax.configuration.read'); return this.repository.list(c.tenantId, c.organizationId); }

  async update(c: TaxContext, id: string, input: { name: string; rate: number; effectiveTo?: string | null; expectedVersion: number }) {
    await this.authorize(c, 'tax.configuration.update'); this.id(id);
    if (!input.name?.trim() || !Number.isFinite(input.rate) || input.rate < 0 || input.rate > 100) throw new ValidationError('Name and rate between 0 and 100 are required.');
    const value = await this.repository.update({ ...c, id, name: input.name.trim(), rate: input.rate, effectiveTo: input.effectiveTo ?? null, expectedVersion: input.expectedVersion });
    if (!value) throw new ValidationError('Tax rule not found or version conflict.');
    return value;
  }

  async transition(c: TaxContext, id: string, status: TaxStatus, expectedVersion: number) {
    await this.authorize(c, status === 'ACTIVE' ? 'tax.configuration.activate' : 'tax.configuration.deactivate'); this.id(id);
    const value = await this.repository.setStatus({ ...c, id, status, expectedVersion });
    if (!value) throw new ValidationError('Tax rule transition failed or version conflict.');
    await this.audit.record({ tenantId: c.tenantId, actorUserId: c.userId, action: `tax.${status.toLowerCase()}`, resourceType: 'tax_rule', resourceId: id, outcome: 'success' });
    return value;
  }

  async calculate(c: TaxContext, input: { amount: number; asOf: string }): Promise<TaxResolution> {
    await this.authorize(c, 'tax.configuration.read');
    if (!Number.isFinite(input.amount) || input.amount < 0) throw new ValidationError('Taxable amount must be non-negative.');
    const rule = await this.repository.resolve({ ...c, asOf: input.asOf });
    if (!rule) throw new NotFoundError('No active tax rule is effective for the requested date.');
    return { ruleId: rule.id, code: rule.code, rate: rule.rate, taxAmount: Number((input.amount * rule.rate / 100).toFixed(4)), effectiveDate: input.asOf };
  }

  private async authorize(c: TaxContext, permission: string) {
    if (!c.userId?.trim()) throw new UnauthorizedError();
    for (const [value, label] of [[c.tenantId, 'Tenant ID'], [c.organizationId, 'Organization ID'], [c.userId, 'User ID']] as const) this.id(value, label);
    if (!(await this.modules.isModuleEnabled(c.tenantId, c.organizationId, 'sales'))) throw new ForbiddenError('Sales module is not enabled.');
    if (!(await this.auth.hasPermission(c.tenantId, c.userId, permission))) throw new ForbiddenError('Insufficient tax permission.');
  }
  private id(value: string, label = 'Tax rule ID') { if (!value || !isUuid(value)) throw new ValidationError(`${label} must be a valid UUID.`); }
}

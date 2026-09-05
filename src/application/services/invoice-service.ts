import { validate as isUuid } from 'uuid';
import type { AuditLogger } from '../contracts/audit.js';
import type { AuthorizationService } from './authorization-service.js';
import type { ModuleAccessService } from './module-access-service.js';
import type { InvoiceRecord, InvoiceRepository } from '../../domain/contracts/repositories.js';
import { INVOICE_PERMISSIONS, type InvoicePermission, type InvoiceStatus } from '../../domain/contracts/invoice.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors.js';
import type { TaxCalculationPort } from '../../domain/contracts/sales-dependencies.js';
import type { FinancePostingPort } from '../../domain/contracts/sales-dependencies.js';

export interface InvoiceContext {
  tenantId: string; organizationId: string; branchId: string; financialYearId: string; userId: string;
}
export interface InvoiceTransactionRunner { runInTransaction<T>(callback: () => Promise<T>): Promise<T>; }
const transitions: Record<InvoiceStatus, InvoiceStatus[]> = { DRAFT: ['ISSUED', 'CANCELLED'], ISSUED: [], CANCELLED: [] };

export class InvoiceService {
  constructor(
    private readonly repository: InvoiceRepository,
    private readonly authorizationService: Pick<AuthorizationService, 'hasPermission'>,
    private readonly moduleAccessService: Pick<ModuleAccessService, 'isModuleEnabled'>,
    private readonly auditLogger: AuditLogger,
    private readonly transactionRunner: InvoiceTransactionRunner,
    private readonly tax?: TaxCalculationPort,
    private readonly finance?: FinancePostingPort,
  ) {}
  async create(context: InvoiceContext, input: { deliveryId: string; idempotencyKey: string; notes?: string | null }): Promise<InvoiceRecord> {
    await this.authorize(context, INVOICE_PERMISSIONS.create);
    this.validateId(input.deliveryId, 'Delivery ID');
    const key = input.idempotencyKey?.trim();
    if (!key || key.length > 128) throw new ValidationError('Idempotency key is required and must be at most 128 characters.');
    const allowReplay = await this.authorizationService.hasPermission(context.tenantId, context.userId, INVOICE_PERMISSIONS.read);
    return this.transactionRunner.runInTransaction(async () => {
      const invoice = await this.repository.create({ ...context, deliveryId: input.deliveryId, idempotencyKey: key, notes: input.notes ?? null, actorUserId: context.userId, allowReplay });
      await this.auditLogger.record({ tenantId: context.tenantId, actorUserId: context.userId, action: 'invoice.created', resourceType: 'sales_invoice', resourceId: invoice.id, outcome: 'success' }, { requireTransaction: true });
      return invoice;
    });
  }
  async get(context: InvoiceContext, id: string) {
    await this.authorize(context, INVOICE_PERMISSIONS.read);
    this.validateId(id, 'Invoice ID');
    const invoice = await this.repository.getById(context.tenantId, context.organizationId, context.branchId, context.financialYearId, id);
    if (!invoice) throw new NotFoundError('Invoice not found.');
    return invoice;
  }
  async list(context: InvoiceContext, input: { page: number; pageSize: number; order: 'asc' | 'desc'; search?: string }) {
    await this.authorize(context, INVOICE_PERMISSIONS.read);
    return this.repository.list(context.tenantId, { ...input, organizationId: context.organizationId, branchId: context.branchId, financialYearId: context.financialYearId });
  }
  async update(context: InvoiceContext, id: string, input: { notes?: string | null; expectedVersion: number }) {
    await this.authorize(context, INVOICE_PERMISSIONS.update);
    this.validateId(id, 'Invoice ID');
    this.validateVersion(input.expectedVersion);
    const invoice = await this.repository.update({ ...context, invoiceId: id, notes: input.notes ?? null, expectedVersion: input.expectedVersion, actorUserId: context.userId });
    if (!invoice) throw new ValidationError('Draft invoice not found or version conflict.');
    return invoice;
  }
  async transition(context: InvoiceContext, id: string, status: InvoiceStatus, expectedVersion: number) {
    await this.authorize(context, status === 'ISSUED' ? INVOICE_PERMISSIONS.issue : INVOICE_PERMISSIONS.cancel);
    this.validateId(id, 'Invoice ID');
    this.validateVersion(expectedVersion);
    return this.transactionRunner.runInTransaction(async () => {
      const current = await this.get(context, id);
      if (!transitions[current.status].includes(status)) throw new ValidationError(`Invoice cannot transition from ${current.status} to ${status}.`);
      if (status === 'ISSUED') {
        if (!this.tax || !this.repository.updateTaxSnapshot) throw new ValidationError('Tax provider is not configured.');
        const taxableAmount = current.items.reduce((total, item) => total + item.lineTotal, 0);
        const result = await this.tax.calculate({ ...context, actorUserId: context.userId, correlationId: id, idempotencyKey: `invoice-tax:${id}` }, 'INVOICE', id, taxableAmount);
        if (result.status !== 'CALCULATED' || !result.reference || result.rate === undefined || result.taxableAmount === undefined || result.taxAmount === undefined) throw new ValidationError('Authoritative tax calculation failed.');
        const snapshotted = await this.repository.updateTaxSnapshot({ ...context, invoiceId: id, taxReference: result.reference, taxRate: result.rate, taxableAmount: result.taxableAmount, taxAmount: result.taxAmount, actorUserId: context.userId });
        if (!snapshotted) throw new ValidationError('Invoice tax snapshot could not be persisted.');
        if (!this.finance || !this.repository.updateFinanceStatus) throw new ValidationError('Finance provider is not configured.');
        const posting = await this.finance.submitSalesDocument({ ...context, actorUserId: context.userId, correlationId: id, idempotencyKey: `invoice-finance:${id}` }, 'INVOICE', id, result.taxableAmount + result.taxAmount);
        if (posting.status !== 'POSTED' || !posting.reference) throw new ValidationError('Finance posting failed.');
        const posted = await this.repository.updateFinanceStatus({ ...context, invoiceId: id, financeReference: posting.reference, actorUserId: context.userId });
        if (!posted) throw new ValidationError('Invoice finance status could not be persisted.');
      }
      const invoice = await this.repository.transition({ ...context, invoiceId: id, status, expectedVersion: status === 'ISSUED' ? expectedVersion + 2 : expectedVersion, actorUserId: context.userId });
      if (!invoice) throw new ValidationError('Invoice not found or version conflict.');
      await this.auditLogger.record({ tenantId: context.tenantId, actorUserId: context.userId, action: `invoice.${status.toLowerCase()}`, resourceType: 'sales_invoice', resourceId: id, outcome: 'success' }, { requireTransaction: true });
      return invoice;
    });
  }
  private async authorize(context: InvoiceContext, permission: InvoicePermission) {
    if (!context.userId?.trim()) throw new UnauthorizedError();
    for (const [value, label] of [[context.tenantId, 'Tenant ID'], [context.organizationId, 'Organization ID'], [context.branchId, 'Branch ID'], [context.financialYearId, 'Financial Year ID'], [context.userId, 'User ID']] as const) this.validateId(value, label);
    if (!(await this.moduleAccessService.isModuleEnabled(context.tenantId, context.organizationId, 'sales'))) throw new ForbiddenError('Sales module is not enabled.');
    if (!(await this.authorizationService.hasPermission(context.tenantId, context.userId, permission))) throw new ForbiddenError('Insufficient invoice permission.');
  }
  private validateId(value: string, label: string) { if (!value || !isUuid(value)) throw new ValidationError(`${label} must be a valid UUID.`); }
  private validateVersion(value: number) { if (!Number.isInteger(value) || value < 1) throw new ValidationError('Expected version must be a positive integer.'); }
}

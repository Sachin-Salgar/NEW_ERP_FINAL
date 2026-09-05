import { validate as isUuid } from 'uuid';
import type { AuditLogger } from '../contracts/audit.js';
import type { AuthorizationService } from './authorization-service.js';
import type { ModuleAccessService } from './module-access-service.js';
import type { QuotationRepository, QuotationRecord, QuotationItemInput } from '../../domain/contracts/repositories.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors.js';
import {
  QUOTATION_PERMISSIONS,
  SALES_MODULE_CODE,
  type QuotationPermission,
  type QuotationStatus,
} from '../../domain/contracts/quotation.js';

export interface QuotationContext {
  tenantId: string;
  organizationId: string;
  branchId: string;
  financialYearId: string;
  userId: string;
}
export interface QuotationTransactionRunner {
  runInTransaction<T>(callback: () => Promise<T>): Promise<T>;
}
const transitions: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export class QuotationService {
  constructor(
    private readonly repository: QuotationRepository,
    private readonly auth: Pick<AuthorizationService, 'hasPermission'>,
    private readonly modules: Pick<ModuleAccessService, 'isModuleEnabled'>,
    private readonly audit: AuditLogger,
    private readonly tx: QuotationTransactionRunner,
  ) {}

  async create(
    c: QuotationContext,
    input: {
      customerId: string;
      quotationDate: string;
      validUntil: string;
      notes?: string | null;
      items: QuotationItemInput[];
    },
  ) {
    await this.authorize(c, QUOTATION_PERMISSIONS.create);
    this.validateInput(c, input);
    return this.tx.runInTransaction(async () => {
      const q = await this.repository.create({ ...input, ...c, actorUserId: c.userId });
      await this.audit.record(
        {
          tenantId: c.tenantId,
          actorUserId: c.userId,
          action: 'quotation.created',
          resourceType: 'sales_quotation',
          resourceId: q.id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return q;
    });
  }
  async list(c: QuotationContext, input: { page: number; pageSize: number; order: 'asc' | 'desc'; search?: string }) {
    await this.authorize(c, QUOTATION_PERMISSIONS.read);
    if (input.search && input.search.length > 100) throw new ValidationError('Search must be 100 characters or fewer.');
    return this.repository.list(c.tenantId, {
      organizationId: c.organizationId,
      branchId: c.branchId,
      financialYearId: c.financialYearId,
      ...input,
    });
  }
  async get(c: QuotationContext, id: string) {
    await this.authorize(c, QUOTATION_PERMISSIONS.read);
    this.id(id, 'Quotation ID');
    const q = await this.repository.getById(c.tenantId, c.organizationId, c.branchId, c.financialYearId, id);
    if (!q) throw new NotFoundError('Quotation not found.');
    return q;
  }
  async update(
    c: QuotationContext,
    id: string,
    input: {
      customerId: string;
      quotationDate: string;
      validUntil: string;
      notes?: string | null;
      items: QuotationItemInput[];
    },
  ) {
    await this.authorize(c, QUOTATION_PERMISSIONS.update);
    this.id(id, 'Quotation ID');
    this.validateInput(c, input);
    return this.tx.runInTransaction(async () => {
      const q = await this.repository.update({ ...input, ...c, quotationId: id, actorUserId: c.userId });
      if (!q) throw new NotFoundError('Draft quotation not found.');
      await this.audit.record(
        {
          tenantId: c.tenantId,
          actorUserId: c.userId,
          action: 'quotation.updated',
          resourceType: 'sales_quotation',
          resourceId: q.id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return q;
    });
  }
  async delete(c: QuotationContext, id: string) {
    await this.authorize(c, QUOTATION_PERMISSIONS.delete);
    this.id(id, 'Quotation ID');
    return this.tx.runInTransaction(async () => {
      const current = await this.repository.getById(c.tenantId, c.organizationId, c.branchId, c.financialYearId, id);
      if (!current) throw new NotFoundError('Quotation not found.');
      if (current.status !== 'DRAFT') throw new ValidationError('Only draft quotations can be deleted.');
      const q = await this.repository.softDelete({ ...c, quotationId: id, actorUserId: c.userId });
      if (!q) throw new NotFoundError('Draft quotation not found.');
      await this.audit.record(
        {
          tenantId: c.tenantId,
          actorUserId: c.userId,
          action: 'quotation.deleted',
          resourceType: 'sales_quotation',
          resourceId: id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return q;
    });
  }
  async transition(c: QuotationContext, id: string, status: QuotationStatus): Promise<QuotationRecord> {
    const permissionKey =
      status === 'SENT' ? 'send' : status === 'CANCELLED' ? 'cancel' : status.toLowerCase();
    const permission = (QUOTATION_PERMISSIONS as Record<string, string>)[permissionKey];
    await this.authorize(c, permission as QuotationPermission);
    this.id(id, 'Quotation ID');
    return this.transitionInternal(c, id, status, 'quotation.' + status.toLowerCase(), false);
  }
  private async transitionInternal(
    c: QuotationContext,
    id: string,
    status: QuotationStatus,
    action: string,
    soft: boolean,
  ): Promise<QuotationRecord> {
    return this.tx.runInTransaction(async () => {
      const current = await this.repository.getById(c.tenantId, c.organizationId, c.branchId, c.financialYearId, id);
      if (!current) throw new NotFoundError('Quotation not found.');
      if (!transitions[current.status].includes(status))
        throw new ValidationError(`Quotation cannot transition from ${current.status} to ${status}.`);
      const q = soft
        ? await this.repository.softDelete({ ...c, quotationId: id, actorUserId: c.userId })
        : await this.repository.transition({ ...c, quotationId: id, status, actorUserId: c.userId });
      if (!q) throw new NotFoundError('Quotation not found.');
      await this.audit.record(
        {
          tenantId: c.tenantId,
          actorUserId: c.userId,
          action,
          resourceType: 'sales_quotation',
          resourceId: id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return q;
    });
  }
  private async authorize(c: QuotationContext, p: QuotationPermission) {
    if (!c.userId?.trim()) throw new UnauthorizedError();
    this.id(c.tenantId, 'Tenant ID');
    this.id(c.organizationId, 'Organization ID');
    this.id(c.branchId, 'Branch ID');
    this.id(c.financialYearId, 'Financial Year ID');
    this.id(c.userId, 'User ID');
    if (!(await this.modules.isModuleEnabled(c.tenantId, c.organizationId, SALES_MODULE_CODE)))
      throw new ForbiddenError('Sales module is not enabled.');
    if (!(await this.auth.hasPermission(c.tenantId, c.userId, p)))
      throw new ForbiddenError('Insufficient quotation permission.');
  }
  private validateInput(
    c: QuotationContext,
    i: { customerId: string; quotationDate: string; validUntil: string; items: QuotationItemInput[] },
  ) {
    this.id(i.customerId, 'Customer ID');
    if (
      !i.quotationDate ||
      !i.validUntil ||
      Number.isNaN(Date.parse(i.quotationDate)) ||
      Number.isNaN(Date.parse(i.validUntil)) ||
      new Date(i.validUntil) < new Date(i.quotationDate)
    )
      throw new ValidationError('Quotation dates are invalid.');
    if (!Array.isArray(i.items) || i.items.length < 1)
      throw new ValidationError('A quotation requires at least one item.');
    const lines = new Set<number>();
    i.items.forEach((x, n) => {
      if (!x.description?.trim()) throw new ValidationError(`Item ${n + 1} description is required.`);
      if (x.quantity <= 0 || x.unitPrice < 0 || !x.unitOfMeasure?.trim())
        throw new ValidationError('Item description, unit of measure, quantity and unit price are required.');
      if (lines.has(n + 1)) throw new ValidationError('Quotation item line numbers must be unique.');
      lines.add(n + 1);
    });
  }
  private id(id: string, label: string) {
    if (!id || !isUuid(id)) throw new ValidationError(`${label} must be a valid UUID.`);
  }
}

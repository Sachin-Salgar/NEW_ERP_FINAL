import { validate as isUuid } from 'uuid';
import type { AuditLogger } from '../contracts/audit.js';
import type { AuthorizationService } from './authorization-service.js';
import type { ModuleAccessService } from './module-access-service.js';
import type { SalesReturnRecord, SalesReturnRepository } from '../../domain/contracts/repositories.js';
import { SALES_RETURN_PERMISSIONS, type SalesReturnPermission, type SalesReturnStatus } from '../../domain/contracts/sales-return.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors.js';

export interface SalesReturnContext { tenantId: string; organizationId: string; branchId: string; financialYearId: string; userId: string; }
export interface SalesReturnTransactionRunner { runInTransaction<T>(callback: () => Promise<T>): Promise<T>; }
const transitions: Record<SalesReturnStatus, SalesReturnStatus[]> = {
  REQUESTED: ['INSPECTED', 'CANCELLED'], INSPECTED: ['APPROVED', 'REJECTED'], APPROVED: ['PROCESSED'],
  PROCESSED: ['CLOSED'], CLOSED: [], REJECTED: [], CANCELLED: [],
};
export class SalesReturnService {
  constructor(private readonly repository: SalesReturnRepository, private readonly auth: Pick<AuthorizationService, 'hasPermission'>, private readonly modules: Pick<ModuleAccessService, 'isModuleEnabled'>, private readonly audit: AuditLogger, private readonly tx: SalesReturnTransactionRunner) {}
  async create(context: SalesReturnContext, input: { invoiceId: string; idempotencyKey: string; notes?: string | null; items?: Array<{ invoiceItemId: string; quantity: number }> }): Promise<SalesReturnRecord> {
    await this.authorize(context, SALES_RETURN_PERMISSIONS.create); this.id(input.invoiceId, 'Invoice ID');
    const key = input.idempotencyKey?.trim(); if (!key || key.length > 128) throw new ValidationError('Idempotency key is required and must be at most 128 characters.');
    if (input.items) {
      if (input.items.length === 0) throw new ValidationError('At least one return line is required.');
      const seen = new Set<string>();
      for (const item of input.items) {
        this.id(item.invoiceItemId, 'Invoice item ID');
        if (seen.has(item.invoiceItemId) || !Number.isFinite(item.quantity) || item.quantity <= 0)
          throw new ValidationError('Return lines must contain unique invoice items and positive quantities.');
        seen.add(item.invoiceItemId);
      }
    }
    return this.tx.runInTransaction(async () => { const value = await this.repository.create({ ...context, invoiceId: input.invoiceId, idempotencyKey: key, notes: input.notes ?? null, items: input.items, actorUserId: context.userId }); await this.audit.record({ tenantId: context.tenantId, actorUserId: context.userId, action: 'sales_return.created', resourceType: 'sales_return', resourceId: value.id, outcome: 'success' }, { requireTransaction: true }); return value; });
  }
  async get(context: SalesReturnContext, id: string) { await this.authorize(context, SALES_RETURN_PERMISSIONS.read); this.id(id, 'Return ID'); const value = await this.repository.getById(context.tenantId, context.organizationId, context.branchId, context.financialYearId, id); if (!value) throw new NotFoundError('Sales Return not found.'); return value; }
  async list(context: SalesReturnContext, input: { page: number; pageSize: number; order: 'asc' | 'desc'; search?: string }) { await this.authorize(context, SALES_RETURN_PERMISSIONS.read); return this.repository.list(context.tenantId, { ...input, organizationId: context.organizationId, branchId: context.branchId, financialYearId: context.financialYearId }); }
  async update(context: SalesReturnContext, id: string, input: { notes?: string | null; expectedVersion: number }) { await this.authorize(context, SALES_RETURN_PERMISSIONS.update); this.id(id, 'Return ID'); this.version(input.expectedVersion); const value = await this.repository.update({ ...context, returnId: id, notes: input.notes ?? null, expectedVersion: input.expectedVersion, actorUserId: context.userId }); if (!value) throw new ValidationError('Requested return not found or version conflict.'); return value; }
  async transition(context: SalesReturnContext, id: string, status: SalesReturnStatus, expectedVersion: number) { const action = status === 'INSPECTED' ? 'inspect' : status === 'APPROVED' ? 'approve' : status === 'REJECTED' ? 'reject' : status === 'PROCESSED' ? 'process' : status === 'CLOSED' ? 'close' : 'cancel'; await this.authorize(context, SALES_RETURN_PERMISSIONS[action]); this.id(id, 'Return ID'); this.version(expectedVersion); return this.tx.runInTransaction(async () => { const current = await this.get(context, id); if (!transitions[current.status].includes(status)) throw new ValidationError(`Sales Return cannot transition from ${current.status} to ${status}.`); const value = await this.repository.transition({ ...context, returnId: id, status, expectedVersion, actorUserId: context.userId }); if (!value) throw new ValidationError('Sales Return not found or version conflict.'); await this.audit.record({ tenantId: context.tenantId, actorUserId: context.userId, action: `sales_return.${status.toLowerCase()}`, resourceType: 'sales_return', resourceId: id, outcome: 'success' }, { requireTransaction: true }); return value; }); }
  private async authorize(c: SalesReturnContext, p: SalesReturnPermission) { if (!c.userId?.trim()) throw new UnauthorizedError(); for (const [v,l] of [[c.tenantId,'Tenant ID'],[c.organizationId,'Organization ID'],[c.branchId,'Branch ID'],[c.financialYearId,'Financial Year ID'],[c.userId,'User ID']] as const) this.id(v,l); if (!(await this.modules.isModuleEnabled(c.tenantId,c.organizationId,'sales'))) throw new ForbiddenError('Sales module is not enabled.'); if (!(await this.auth.hasPermission(c.tenantId,c.userId,p))) throw new ForbiddenError('Insufficient Sales Return permission.'); }
  private id(v:string,l:string){if(!v||!isUuid(v))throw new ValidationError(`${l} must be a valid UUID.`);} private version(v:number){if(!Number.isInteger(v)||v<1)throw new ValidationError('Expected version must be a positive integer.');}
}

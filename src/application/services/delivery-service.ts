import { validate as isUuid } from 'uuid';
import type { AuditLogger } from '../contracts/audit.js';
import type { AuthorizationService } from './authorization-service.js';
import type { ModuleAccessService } from './module-access-service.js';
import type { DeliveryRecord, DeliveryRepository } from '../../domain/contracts/repositories.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors.js';
import { DELIVERY_PERMISSIONS, type DeliveryPermission, type DeliveryStatus } from '../../domain/contracts/delivery.js';
import type { InventoryDependencyPort } from '../../domain/contracts/inventory.js';

export interface DeliveryContext {
  tenantId: string;
  organizationId: string;
  branchId: string;
  financialYearId: string;
  userId: string;
}
export interface DeliveryTransactionRunner { runInTransaction<T>(callback: () => Promise<T>): Promise<T>; }
const transitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  DRAFT: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export class DeliveryService {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly auth: Pick<AuthorizationService, 'hasPermission'>,
    private readonly modules: Pick<ModuleAccessService, 'isModuleEnabled'>,
    private readonly audit: AuditLogger,
    private readonly tx: DeliveryTransactionRunner,
    private readonly inventory?: InventoryDependencyPort,
  ) {}

  async create(context: DeliveryContext, input: { salesOrderId: string; idempotencyKey: string; notes?: string | null }): Promise<DeliveryRecord> {
    await this.authorize(context, DELIVERY_PERMISSIONS.create);
    this.id(input.salesOrderId, 'Sales Order ID');
    const key = input.idempotencyKey?.trim();
    if (!key || key.length > 128) throw new ValidationError('Idempotency key is required and must be at most 128 characters.');
    return this.tx.runInTransaction(async () => {
      const delivery = await this.repository.create({
        ...context,
        salesOrderId: input.salesOrderId,
        idempotencyKey: key,
        notes: input.notes ?? null,
        actorUserId: context.userId,
      });
      if (this.inventory) {
        const reservations = await this.inventory.listReservationsBySource(context, 'SALES_ORDER', input.salesOrderId);
        if (!reservations.length || reservations.some((reservation) => reservation.status !== 'RESERVED')) {
          throw new ValidationError('A delivery requires active Inventory reservations for the Sales Order.');
        }
        const references = delivery.items.map((item) => {
          const reservation = reservations.find((candidate) => candidate.itemId === item.itemId);
          if (!reservation) throw new ValidationError('A delivery line has no matching Inventory reservation.');
          return { orderItemId: item.orderItemId, reservationId: reservation.id };
        });
        if (!this.repository.attachReservationReferences) throw new ValidationError('Delivery reservation reference persistence is not configured.');
        const linked = await this.repository.attachReservationReferences({ ...context, deliveryId: delivery.id, references, actorUserId: context.userId });
        if (!linked) throw new ValidationError('Delivery reservation references could not be persisted.');
        return linked;
      }
      await this.audit.record({
        tenantId: context.tenantId, actorUserId: context.userId, action: 'delivery.created',
        resourceType: 'sales_delivery', resourceId: delivery.id, outcome: 'success',
      }, { requireTransaction: true });
      return delivery;
    });
  }

  async get(context: DeliveryContext, id: string) {
    await this.authorize(context, DELIVERY_PERMISSIONS.read);
    this.id(id, 'Delivery ID');
    const delivery = await this.repository.getById(context.tenantId, context.organizationId, context.branchId, context.financialYearId, id);
    if (!delivery) throw new NotFoundError('Delivery not found.');
    return delivery;
  }

  async list(context: DeliveryContext, input: { page: number; pageSize: number; order: 'asc' | 'desc'; search?: string }) {
    await this.authorize(context, DELIVERY_PERMISSIONS.read);
    return this.repository.list(context.tenantId, { ...input, organizationId: context.organizationId, branchId: context.branchId, financialYearId: context.financialYearId });
  }

  async update(context: DeliveryContext, id: string, input: { notes?: string | null; expectedVersion: number }) {
    await this.authorize(context, DELIVERY_PERMISSIONS.update);
    this.id(id, 'Delivery ID');
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw new ValidationError('Expected version must be a positive integer.');
    const delivery = await this.repository.update({ ...context, deliveryId: id, notes: input.notes ?? null, expectedVersion: input.expectedVersion, actorUserId: context.userId });
    if (!delivery) throw new ValidationError('Draft delivery not found or version conflict.');
    return delivery;
  }

  async transition(context: DeliveryContext, id: string, status: DeliveryStatus, expectedVersion: number) {
    const permissionKey = status === 'DISPATCHED' ? 'dispatch' : status === 'DELIVERED' ? 'deliver' : status === 'COMPLETED' ? 'complete' : 'cancel';
    await this.authorize(context, DELIVERY_PERMISSIONS[permissionKey]);
    this.id(id, 'Delivery ID');
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new ValidationError('Expected version must be a positive integer.');
    return this.tx.runInTransaction(async () => {
      const current = await this.get(context, id);
      if (!transitions[current.status].includes(status)) throw new ValidationError(`Delivery cannot transition from ${current.status} to ${status}.`);
      if (status === 'COMPLETED') {
        if (!this.inventory) throw new ValidationError('Inventory fulfillment provider is not configured.');
        if (!current.items.length || current.items.some((item) => !item.reservationId)) {
          throw new ValidationError('Delivery reservation references are required before completion.');
        }
        await this.inventory.fulfillReservationsBySource(context, 'SALES_ORDER', current.salesOrderId, `sales-delivery:${current.id}`);
      }
      const delivery = await this.repository.transition({ ...context, deliveryId: id, status, expectedVersion, actorUserId: context.userId });
      if (!delivery) throw new ValidationError('Delivery not found or version conflict.');
      await this.audit.record({
        tenantId: context.tenantId, actorUserId: context.userId, action: `delivery.${status.toLowerCase()}`,
        resourceType: 'sales_delivery', resourceId: id, outcome: 'success',
      }, { requireTransaction: true });
      return delivery;
    });
  }

  private async authorize(context: DeliveryContext, permission: DeliveryPermission) {
    if (!context.userId?.trim()) throw new UnauthorizedError();
    for (const [value, label] of [[context.tenantId, 'Tenant ID'], [context.organizationId, 'Organization ID'], [context.branchId, 'Branch ID'], [context.financialYearId, 'Financial Year ID'], [context.userId, 'User ID']] as const) this.id(value, label);
    if (!(await this.modules.isModuleEnabled(context.tenantId, context.organizationId, 'sales'))) throw new ForbiddenError('Sales module is not enabled.');
    if (!(await this.auth.hasPermission(context.tenantId, context.userId, permission))) throw new ForbiddenError('Insufficient delivery permission.');
  }
  private id(value: string, label: string) { if (!value || !isUuid(value)) throw new ValidationError(`${label} must be a valid UUID.`); }
}

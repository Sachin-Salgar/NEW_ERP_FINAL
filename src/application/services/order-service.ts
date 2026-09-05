import { validate as isUuid } from 'uuid';
import type { AuditLogger } from '../contracts/audit.js';
import type { AuthorizationService } from './authorization-service.js';
import type { ModuleAccessService } from './module-access-service.js';
import type { OrderRepository } from '../../domain/contracts/repositories.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors.js';
import {
  ORDER_PERMISSIONS,
  SALES_MODULE_CODE,
  type OrderPermission,
  type OrderStatus,
} from '../../domain/contracts/order.js';
import type { InventoryDependencyPort } from '../../domain/contracts/inventory.js';

export interface OrderContext {
  tenantId: string;
  organizationId: string;
  branchId: string;
  financialYearId: string;
  userId: string;
}
const transitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED', 'CLOSED'],
  CANCELLED: [],
  CLOSED: [],
};

export class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly auth: Pick<AuthorizationService, 'hasPermission'>,
    private readonly modules: Pick<ModuleAccessService, 'isModuleEnabled'>,
    private readonly audit: AuditLogger,
    private readonly tx: { runInTransaction<T>(cb: () => Promise<T>): Promise<T> },
    private readonly inventory?: InventoryDependencyPort,
  ) {}

  async create(c: OrderContext, input: { quotationId: string; warehouseId?: string }) {
    await this.authorize(c, ORDER_PERMISSIONS.create);
    this.id(input.quotationId, 'Quotation ID');
    if (input.warehouseId) this.id(input.warehouseId, 'Warehouse ID');
    return this.tx.runInTransaction(async () => {
      const order = await this.repository.create({ ...c, quotationId: input.quotationId, warehouseId: input.warehouseId, actorUserId: c.userId });
      await this.audit.record(
        {
          tenantId: c.tenantId,
          actorUserId: c.userId,
          action: 'order.created',
          resourceType: 'sales_order',
          resourceId: order.id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return order;
    });
  }
  async list(c: OrderContext, input: { page: number; pageSize: number; order: 'asc' | 'desc'; search?: string }) {
    await this.authorize(c, ORDER_PERMISSIONS.read);
    return this.repository.list(c.tenantId, {
      ...input,
      organizationId: c.organizationId,
      branchId: c.branchId,
      financialYearId: c.financialYearId,
    });
  }
  async get(c: OrderContext, id: string) {
    await this.authorize(c, ORDER_PERMISSIONS.read);
    this.id(id, 'Order ID');
    const x = await this.repository.getById(c.tenantId, c.organizationId, c.branchId, c.financialYearId, id);
    if (!x) throw new NotFoundError('Order not found.');
    return x;
  }
  async update(c: OrderContext, id: string, input: { notes?: string | null; expectedVersion: number }) {
    await this.authorize(c, ORDER_PERMISSIONS.update);
    this.id(id, 'Order ID');
    return this.tx.runInTransaction(async () => {
      const x = await this.repository.update({
        ...c,
        orderId: id,
        notes: input.notes ?? null,
        expectedVersion: input.expectedVersion,
        actorUserId: c.userId,
      });
      if (!x) throw new ValidationError('Draft order not found or version conflict.');
      return x;
    });
  }
  async delete(c: OrderContext, id: string) {
    await this.authorize(c, ORDER_PERMISSIONS.delete);
    this.id(id, 'Order ID');
    const x = await this.repository.softDelete({ ...c, orderId: id, actorUserId: c.userId });
    if (!x) throw new ValidationError('Only draft orders can be deleted.');
    return x;
  }
  async transition(c: OrderContext, id: string, status: OrderStatus, expectedVersion: number) {
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
      throw new ValidationError('Expected version must be a positive integer.');
    const key = status.toLowerCase() as keyof typeof ORDER_PERMISSIONS;
    await this.authorize(c, ORDER_PERMISSIONS[key]);
    this.id(id, 'Order ID');
    return this.tx.runInTransaction(async () => {
      const current = await this.repository.getById(c.tenantId, c.organizationId, c.branchId, c.financialYearId, id);
      if (!current) throw new NotFoundError('Order not found.');
      if (!transitions[current.status].includes(status))
        throw new ValidationError(`Order cannot transition from ${current.status} to ${status}.`);
      let transitionVersion = expectedVersion;
      if (status === 'CANCELLED' && current.reservationStatus === 'RESERVED') {
        if (!this.inventory) throw new ValidationError('Inventory reservation provider is not configured.');
        if (!this.repository.updateReservationStatus) throw new ValidationError('Order reservation state updates are not configured.');
        const reservations = await this.inventory.listReservationsBySource(c, 'SALES_ORDER', current.id);
        for (const reservation of reservations) {
          if (reservation.status === 'RESERVED') {
            await this.inventory.releaseReservation(c, reservation.id, `sales-order-cancel:${current.id}:${reservation.id}`);
          }
        }
        const released = await this.repository.updateReservationStatus({ ...c, orderId: current.id, reservationStatus: 'NOT_RESERVED', actorUserId: c.userId });
        if (!released) throw new ValidationError('Order reservation state could not be released.');
        transitionVersion += 1;
      }
      const x = await this.repository.transition({ ...c, orderId: id, status, expectedVersion: transitionVersion, actorUserId: c.userId });
      if (!x) throw new ValidationError('Order not found or version conflict.');
      await this.audit.record(
        {
          tenantId: c.tenantId,
          actorUserId: c.userId,
          action: `order.${status.toLowerCase()}`,
          resourceType: 'sales_order',
          resourceId: id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return x;
    });
  }
  async reserve(c: OrderContext, id: string) {
    await this.authorize(c, ORDER_PERMISSIONS.reserve);
    this.id(id, 'Order ID');
    if (!this.inventory) throw new ValidationError('Inventory reservation provider is not configured.');
    const inventory = this.inventory;
    return this.tx.runInTransaction(async () => {
      const order = await this.repository.getById(c.tenantId, c.organizationId, c.branchId, c.financialYearId, id);
      if (!order) throw new NotFoundError('Order not found.');
      if (order.status !== 'CONFIRMED') throw new ValidationError('Only confirmed orders can reserve Inventory.');
      if (!order.warehouseId) throw new ValidationError('Order warehouse context is required.');
      if (!order.items.length || order.items.some((item) => !item.itemId))
        throw new ValidationError('Every order line requires an Item Master item.');
      for (const item of order.items) {
        await inventory.reserveStock(c, {
          warehouseId: order.warehouseId,
          itemId: item.itemId!,
          quantity: item.quantity,
          sourceType: 'SALES_ORDER',
          sourceId: order.id,
          idempotencyKey: `sales-order:${order.id}:${item.itemId}`,
        });
      }
      const updated = this.repository.updateReservationStatus
        ? await this.repository.updateReservationStatus({ ...c, orderId: order.id, reservationStatus: 'RESERVED', actorUserId: c.userId })
        : order;
      if (!updated) throw new ValidationError('Order reservation state could not be updated.');
      await this.audit.record(
        { tenantId: c.tenantId, actorUserId: c.userId, action: 'order.reserved', resourceType: 'sales_order', resourceId: order.id, outcome: 'success' },
        { requireTransaction: true },
      );
      return updated;
    });
  }
  private async authorize(c: OrderContext, p: OrderPermission) {
    if (!c.userId?.trim()) throw new UnauthorizedError();
    for (const [v, label] of [
      [c.tenantId, 'Tenant ID'],
      [c.organizationId, 'Organization ID'],
      [c.branchId, 'Branch ID'],
      [c.financialYearId, 'Financial Year ID'],
      [c.userId, 'User ID'],
    ] as const)
      this.id(v, label);
    if (!(await this.modules.isModuleEnabled(c.tenantId, c.organizationId, SALES_MODULE_CODE)))
      throw new ForbiddenError('Sales module is not enabled.');
    if (!(await this.auth.hasPermission(c.tenantId, c.userId, p)))
      throw new ForbiddenError('Insufficient order permission.');
  }
  private id(value: string, label: string) {
    if (!value || !isUuid(value)) throw new ValidationError(`${label} must be a valid UUID.`);
  }
}

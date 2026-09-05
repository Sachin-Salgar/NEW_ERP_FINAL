import { validate as isUuid } from 'uuid';
import type { AuditLogger } from '../contracts/audit.js';
import type {
  InventoryContext,
  InventoryPermission,
  InventoryReservationRequest,
  ReservationStatus,
  WarehouseStatus,
} from '../../domain/contracts/inventory.js';
import { INVENTORY_MODULE_CODE, INVENTORY_PERMISSIONS } from '../../domain/contracts/inventory.js';
import type { InventoryRepository } from '../../domain/contracts/repositories.js';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../domain/errors.js';

export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly authorization: { hasPermission(tenantId: string, userId: string, permission: InventoryPermission): Promise<boolean> },
    private readonly modules: { isModuleEnabled(tenantId: string, organizationId: string, moduleCode: string): Promise<boolean> },
    private readonly audit: AuditLogger,
    private readonly tx: { runInTransaction<T>(callback: () => Promise<T>): Promise<T> },
  ) {}

  async createWarehouse(context: InventoryContext, input: { code: string; name: string }) {
    await this.authorize(context, INVENTORY_PERMISSIONS.warehouseCreate);
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!code || code.length > 100 || !name || name.length > 255) throw new ValidationError('Warehouse code and name are required.');
    return this.tx.runInTransaction(async () => {
      const warehouse = await this.repository.createWarehouse({ ...context, code, name, actorUserId: context.userId });
      await this.record(context, 'inventory.warehouse.created', warehouse.id, 'inventory_warehouse');
      return warehouse;
    });
  }
  async listWarehouses(context: InventoryContext, input: { page?: number; pageSize?: number; search?: string } = {}) {
    await this.authorize(context, INVENTORY_PERMISSIONS.warehouseRead);
    const page = input.page ?? 1; const pageSize = input.pageSize ?? 20;
    this.page(page, pageSize);
    return this.repository.listWarehouses(context.tenantId, context.organizationId, page, pageSize, input.search?.trim() || undefined);
  }
  async updateWarehouse(context: InventoryContext, id: string, input: { name: string; status: WarehouseStatus; expectedVersion: number }) {
    await this.authorize(context, INVENTORY_PERMISSIONS.warehouseUpdate); this.id(id, 'Warehouse ID');
    if (!input.name.trim() || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw new ValidationError('Valid warehouse name and expected version are required.');
    const warehouse = await this.repository.updateWarehouse({ ...context, warehouseId: id, name: input.name.trim(), status: input.status, expectedVersion: input.expectedVersion, actorUserId: context.userId });
    if (!warehouse) throw new ValidationError('Warehouse not found or version is stale.');
    return warehouse;
  }
  async listStock(context: InventoryContext, input: { page?: number; pageSize?: number; warehouseId?: string; itemId?: string } = {}) {
    await this.authorize(context, INVENTORY_PERMISSIONS.stockRead);
    const page = input.page ?? 1; const pageSize = input.pageSize ?? 20; this.page(page, pageSize);
    if (input.warehouseId) this.id(input.warehouseId, 'Warehouse ID'); if (input.itemId) this.id(input.itemId, 'Item ID');
    return this.repository.listStock(context.tenantId, context.organizationId, page, pageSize, input.warehouseId, input.itemId);
  }
  async receive(context: InventoryContext, input: { warehouseId: string; itemId: string; quantity: number; sourceType: string; sourceId: string; operationKey: string }) {
    await this.authorize(context, INVENTORY_PERMISSIONS.stockReceive); this.validateOperation(input);
    return this.tx.runInTransaction(async () => this.repository.receiveStock({ ...context, ...input, actorUserId: context.userId }));
  }
  async reserve(context: InventoryContext, input: InventoryReservationRequest) {
    await this.authorize(context, INVENTORY_PERMISSIONS.reservationCreate); this.validateReservation(input);
    return this.tx.runInTransaction(async () => {
      const result = await this.repository.reserveStock({ ...context, ...input, actorUserId: context.userId });
      await this.record(context, 'inventory.reservation.created', result.id, 'inventory_reservation');
      return result;
    });
  }
  async listReservationsBySource(context: InventoryContext, sourceType: string, sourceId: string) {
    await this.authorize(context, INVENTORY_PERMISSIONS.reservationRead);
    this.id(sourceId, 'Source ID');
    return this.repository.listReservationsBySource({ ...context, sourceType, sourceId });
  }
  async fulfillReservationsBySource(context: InventoryContext, sourceType: string, sourceId: string, operationKey: string) {
    await this.authorize(context, INVENTORY_PERMISSIONS.reservationFulfill);
    this.id(sourceId, 'Source ID'); this.key(operationKey);
    return this.tx.runInTransaction(async () =>
      this.repository.fulfillReservationsBySource({ ...context, sourceType, sourceId, operationKey, actorUserId: context.userId }),
    );
  }
  async listReservations(context: InventoryContext, input: { page?: number; pageSize?: number; status?: ReservationStatus } = {}) {
    await this.authorize(context, INVENTORY_PERMISSIONS.reservationRead);
    const page = input.page ?? 1; const pageSize = input.pageSize ?? 20; this.page(page, pageSize);
    return this.repository.listReservations({ ...context, page, pageSize, status: input.status });
  }
  async release(context: InventoryContext, id: string, operationKey: string) {
    await this.authorize(context, INVENTORY_PERMISSIONS.reservationRelease); this.id(id, 'Reservation ID'); this.key(operationKey);
    return this.tx.runInTransaction(async () => this.repository.releaseReservation({ ...context, reservationId: id, operationKey, actorUserId: context.userId }));
  }
  async fulfill(context: InventoryContext, id: string, operationKey: string) {
    await this.authorize(context, INVENTORY_PERMISSIONS.reservationFulfill); this.id(id, 'Reservation ID'); this.key(operationKey);
    return this.tx.runInTransaction(async () => this.repository.fulfillReservation({ ...context, reservationId: id, operationKey, actorUserId: context.userId }));
  }
  async returnStock(context: InventoryContext, input: Omit<InventoryReservationRequest, 'idempotencyKey'> & { idempotencyKey: string }) {
    await this.authorize(context, INVENTORY_PERMISSIONS.stockReturn); this.validateReservation(input);
    return this.tx.runInTransaction(async () => this.repository.returnStock({ ...context, ...input, operationKey: input.idempotencyKey, actorUserId: context.userId }));
  }
  private async authorize(c: InventoryContext, permission: InventoryPermission) {
    this.validateContext(c);
    if (!(await this.modules.isModuleEnabled(c.tenantId, c.organizationId, INVENTORY_MODULE_CODE))) throw new ForbiddenError('Inventory module is not enabled.');
    if (!(await this.authorization.hasPermission(c.tenantId, c.userId, permission))) throw new ForbiddenError('Insufficient Inventory permission.');
  }
  private validateContext(c: InventoryContext) { if (!c.userId?.trim()) throw new UnauthorizedError(); for (const [v, l] of [[c.tenantId, 'Tenant ID'], [c.organizationId, 'Organization ID'], [c.branchId, 'Branch ID'], [c.financialYearId, 'Financial Year ID'], [c.userId, 'User ID']] as const) this.id(v, l); }
  private validateReservation(input: { warehouseId: string; itemId: string; quantity: number; sourceType: string; sourceId: string; idempotencyKey: string }) {
    this.id(input.warehouseId, 'Warehouse ID'); this.id(input.itemId, 'Item ID'); this.id(input.sourceId, 'Source ID');
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new ValidationError('Quantity must be greater than zero.');
    if (!input.sourceType.trim() || input.sourceType.length > 80) throw new ValidationError('Source type is required.');
    this.key(input.idempotencyKey);
  }
  private validateOperation(input: { warehouseId: string; itemId: string; quantity: number; sourceType: string; sourceId: string; operationKey: string }) {
    this.validateReservation({ ...input, idempotencyKey: input.operationKey });
  }
  private page(page: number, pageSize: number) { if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new ValidationError('Invalid pagination.'); }
  private key(key: string) { if (!key?.trim() || key.length > 128) throw new ValidationError('Idempotency key is required and must be at most 128 characters.'); }
  private id(id: string, label: string) { if (!id || !isUuid(id)) throw new ValidationError(`${label} must be a valid UUID.`); }
  private async record(c: InventoryContext, action: string, resourceId: string, resourceType: string) { await this.audit.record({ tenantId: c.tenantId, actorUserId: c.userId, action, resourceType, resourceId, outcome: 'success' }, { requireTransaction: true }); }
}

export const INVENTORY_MODULE_CODE = 'inventory';

export const INVENTORY_PERMISSIONS = {
  warehouseRead: 'inventory.warehouse.read',
  warehouseCreate: 'inventory.warehouse.create',
  warehouseUpdate: 'inventory.warehouse.update',
  stockRead: 'inventory.stock.read',
  stockReceive: 'inventory.stock.receive',
  reservationRead: 'inventory.reservation.read',
  reservationCreate: 'inventory.reservation.create',
  reservationRelease: 'inventory.reservation.release',
  reservationFulfill: 'inventory.reservation.fulfill',
  stockReturn: 'inventory.stock.return',
} as const;

export type InventoryPermission = (typeof INVENTORY_PERMISSIONS)[keyof typeof INVENTORY_PERMISSIONS];
export type WarehouseStatus = 'ACTIVE' | 'INACTIVE';
export type ReservationStatus = 'RESERVED' | 'RELEASED' | 'FULFILLED';
export type MovementType = 'RECEIPT' | 'ISSUE' | 'RETURN';

export interface InventoryContext {
  tenantId: string;
  organizationId: string;
  branchId: string;
  financialYearId: string;
  userId: string;
}

export interface InventoryReservationRequest {
  warehouseId: string;
  itemId: string;
  quantity: number;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
}

export interface InventoryReservationResult {
  id: string;
  tenantId: string;
  organizationId: string;
  branchId: string;
  financialYearId: string;
  warehouseId: string;
  itemId: string;
  quantity: number;
  sourceType: string;
  sourceId: string;
  status: ReservationStatus;
  version: number;
}

export interface InventoryDependencyPort {
  reserveStock(
    context: InventoryContext,
    request: InventoryReservationRequest,
  ): Promise<InventoryReservationResult>;
  releaseReservation(context: InventoryContext, reservationId: string, idempotencyKey: string): Promise<InventoryReservationResult>;
  fulfillReservation(context: InventoryContext, reservationId: string, idempotencyKey: string): Promise<InventoryReservationResult>;
  returnStock(
    context: InventoryContext,
    request: Omit<InventoryReservationRequest, 'idempotencyKey'> & { idempotencyKey: string },
  ): Promise<InventoryReservationResult>;
}

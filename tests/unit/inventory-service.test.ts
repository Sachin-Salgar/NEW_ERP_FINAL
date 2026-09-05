import { describe, expect, it, vi } from 'vitest';
import { InventoryService } from '../../src/application/services/inventory-service.js';

const context = {
  tenantId: '00000000-0000-7000-8000-000000000001',
  organizationId: '00000000-0000-7000-8000-000000000002',
  branchId: '00000000-0000-7000-8000-000000000003',
  financialYearId: '00000000-0000-7000-8000-000000000004',
  userId: '00000000-0000-7000-8000-000000000005',
};

function service(repository: Record<string, unknown>) {
  return new InventoryService(
    repository as never,
    { hasPermission: vi.fn().mockResolvedValue(true) },
    { isModuleEnabled: vi.fn().mockResolvedValue(true) },
    { record: vi.fn().mockResolvedValue(undefined) },
    { runInTransaction: async <T>(callback: () => Promise<T>) => callback() },
  );
}

describe('InventoryService', () => {
  it('rejects non-positive quantities before reaching the repository', async () => {
    const repository = { reserveStock: vi.fn() };
    await expect(service(repository).reserve(context, {
      warehouseId: context.organizationId,
      itemId: context.branchId,
      quantity: 0,
      sourceType: 'SALES_ORDER',
      sourceId: context.financialYearId,
      idempotencyKey: 'reserve-1',
    })).rejects.toThrow('Quantity must be greater than zero.');
    expect(repository.reserveStock).not.toHaveBeenCalled();
  });

  it('uses a transaction for reservation and records the result', async () => {
    const reservation = { id: context.financialYearId, quantity: 2, status: 'RESERVED' };
    const repository = { reserveStock: vi.fn().mockResolvedValue(reservation) };
    const result = await service(repository).reserve(context, {
      warehouseId: context.organizationId,
      itemId: context.branchId,
      quantity: 2,
      sourceType: 'SALES_ORDER',
      sourceId: context.financialYearId,
      idempotencyKey: 'reserve-2',
    });
    expect(result).toBe(reservation);
    expect(repository.reserveStock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: context.tenantId,
      sourceType: 'SALES_ORDER',
      actorUserId: context.userId,
    }));
  });

  it('rejects an invalid lifecycle identifier for fulfillment', async () => {
    await expect(service({}).fulfill(context, 'not-a-uuid', 'fulfill-1')).rejects.toThrow('Reservation ID must be a valid UUID.');
  });
});

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ProcurementService } from '../../src/application/services/procurement-service.js';
import type { ProcurementRepository } from '../../src/domain/contracts/procurement.js';

const context = {
  tenantId: randomUUID(),
  organizationId: randomUUID(),
  branchId: randomUUID(),
  financialYearId: randomUUID(),
  userId: randomUUID(),
};

describe('ProcurementService receipt completion', () => {
  it('posts Inventory once and returns the existing receipt on an idempotent retry', async () => {
    const receiptId = randomUUID();
    let completed = false;
    const repository = {
      completeReceipt: async () => {
        const alreadyCompleted = completed;
        completed = true;
        return {
          receipt: { id: receiptId, warehouseId: randomUUID(), operationKey: 'receipt-key' },
          lines: [{ itemId: randomUUID(), quantity: 2 }],
          alreadyCompleted,
        };
      },
    } as unknown as ProcurementRepository;
    let inventoryCalls = 0;
    const service = new ProcurementService(
      repository,
      { hasPermission: async () => true },
      { isModuleEnabled: async () => true },
      { record: async () => undefined },
      { runInTransaction: async <T>(fn: () => Promise<T>) => fn() },
      {
        receiveStock: async () => {
          inventoryCalls += 1;
        },
        listReservationsBySource: async () => [],
        fulfillReservationsBySource: async () => [],
        reserveStock: async () => {
          throw new Error();
        },
        releaseReservation: async () => {
          throw new Error();
        },
        fulfillReservation: async () => {
          throw new Error();
        },
        returnStock: async () => {
          throw new Error();
        },
      },
    );
    await service.completeReceipt(context, { id: receiptId, expectedVersion: 1 });
    await service.completeReceipt(context, { id: receiptId, expectedVersion: 2 });
    expect(inventoryCalls).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { calculateCommercialLine, calculateCommercialTotals } from '../../src/domain/commercial-calculation.js';
import { resolveCommercialLines } from '../../src/application/services/commercial-transaction-service.js';

describe('commercial calculation', () => {
  it('applies price then one non-stacking percentage discount', () => {
    const line = calculateCommercialLine({ quantity: 2, unitPrice: 12.5, discountPercentage: 10 });
    expect(line).toMatchObject({ grossTotal: 25, discountAmount: 2.5, lineTotal: 22.5 });
    expect(calculateCommercialTotals([line])).toEqual({ subtotal: 25, discountTotal: 2.5, total: 22.5 });
  });

  it('resolves and snapshots price-list and discount identities', async () => {
    const result = await resolveCommercialLines(
      { tenantId: 't', organizationId: 'o', branchId: 'b', userId: 'u' },
      [{ itemCode: 'ITEM-1', unitOfMeasure: 'each', quantity: 3, unitPrice: 99 }],
      '2026-09-05',
      { resolvePrice: async () => ({ id: 'price-item', priceListId: 'price-list', price: 10 }) },
      { resolve: async () => ({ id: 'discount-rule', percentage: 20 }) },
    );
    expect(result.lines[0]).toMatchObject({
      unitPrice: 10,
      discountPercentage: 20,
      discountAmount: 6,
      lineTotal: 24,
      priceListId: 'price-list',
      discountRuleId: 'discount-rule',
    });
  });
});

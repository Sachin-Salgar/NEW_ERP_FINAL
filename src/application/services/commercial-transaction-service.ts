import { calculateCommercialLine, calculateCommercialTotals, type CommercialTotals } from '../../domain/commercial-calculation.js';
import { ValidationError } from '../../domain/errors.js';

export interface TransactionCommercialContext {
  tenantId: string;
  organizationId: string;
  branchId: string;
  userId: string;
}

export interface TransactionPriceResolver {
  resolvePrice(
    context: TransactionCommercialContext,
    input: { itemCode: string; unitOfMeasure: string; asOf: string },
  ): Promise<{ id: string; priceListId: string; price: number } | null>;
}

export interface TransactionDiscountResolver {
  resolve(
    context: TransactionCommercialContext,
    asOf: string,
  ): Promise<{ id: string; percentage: number } | null>;
}

export interface ResolvedCommercialLine {
  unitPrice: number;
  discountPercentage: number;
  discountAmount: number;
  lineTotal: number;
  priceListId: string | null;
  discountRuleId: string | null;
}

export async function resolveCommercialLines(
  context: TransactionCommercialContext,
  items: Array<{ itemCode?: string | null; unitOfMeasure: string; quantity: number; unitPrice: number }>,
  asOf: string,
  pricing?: TransactionPriceResolver,
  discounts?: TransactionDiscountResolver,
): Promise<{ lines: ResolvedCommercialLine[]; totals: CommercialTotals }> {
  const discount = discounts ? await discounts.resolve(context, asOf) : null;
  const lines: ResolvedCommercialLine[] = [];
  for (const item of items) {
    const price = item.itemCode && pricing
      ? await pricing.resolvePrice(context, { itemCode: item.itemCode, unitOfMeasure: item.unitOfMeasure, asOf })
      : null;
    if (item.itemCode && pricing && !price) throw new ValidationError(`No applicable published price exists for item ${item.itemCode}.`);
    const calculated = calculateCommercialLine({
      quantity: item.quantity,
      unitPrice: price?.price ?? item.unitPrice,
      discountPercentage: discount?.percentage ?? 0,
    });
    lines.push({
      unitPrice: calculated.unitPrice,
      discountPercentage: calculated.discountPercentage,
      discountAmount: calculated.discountAmount,
      lineTotal: calculated.lineTotal,
      priceListId: price?.priceListId ?? null,
      discountRuleId: discount?.id ?? null,
    });
  }
  return {
    lines,
    totals: calculateCommercialTotals(lines.map((line, index) => ({
      ...line,
      grossTotal: items[index].quantity * line.unitPrice,
    }))),
  };
}

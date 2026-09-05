export interface CommercialLineInput {
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
}

export interface CommercialLineResult {
  unitPrice: number;
  discountPercentage: number;
  discountAmount: number;
  lineTotal: number;
  grossTotal: number;
}

export interface CommercialTotals {
  subtotal: number;
  discountTotal: number;
  total: number;
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000;

export function calculateCommercialLine(input: CommercialLineInput): CommercialLineResult {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('Quantity must be positive.');
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) throw new Error('Unit price must be non-negative.');
  const discountPercentage = input.discountPercentage ?? 0;
  if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100)
    throw new Error('Discount percentage must be between 0 and 100.');
  const gross = money(input.quantity * input.unitPrice);
  const discountAmount = money(gross * (discountPercentage / 100));
  return {
    unitPrice: money(input.unitPrice),
    discountPercentage,
    discountAmount,
    lineTotal: money(gross - discountAmount),
    grossTotal: gross,
  };
}

export function calculateCommercialTotals(lines: CommercialLineResult[]): CommercialTotals {
  const subtotal = money(lines.reduce((total, line) => total + line.grossTotal, 0));
  const discountTotal = money(lines.reduce((total, line) => total + line.discountAmount, 0));
  return { subtotal, discountTotal, total: money(subtotal - discountTotal) };
}

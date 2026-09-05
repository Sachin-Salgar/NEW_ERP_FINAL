export const INVOICE_PERMISSIONS = {
  read: 'sales.invoice.read',
  create: 'sales.invoice.create',
  update: 'sales.invoice.update',
  issue: 'sales.invoice.issue',
  cancel: 'sales.invoice.cancel',
} as const;

export type InvoicePermission = (typeof INVOICE_PERMISSIONS)[keyof typeof INVOICE_PERMISSIONS];
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

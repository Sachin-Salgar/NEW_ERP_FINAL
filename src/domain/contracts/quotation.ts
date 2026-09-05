export const SALES_MODULE_CODE = 'sales';
export const QUOTATION_PERMISSIONS = {
  read: 'sales.quotation.read',
  create: 'sales.quotation.create',
  update: 'sales.quotation.update',
  delete: 'sales.quotation.delete',
  send: 'sales.quotation.send',
  accept: 'sales.quotation.accept',
  reject: 'sales.quotation.reject',
  expire: 'sales.quotation.expire',
  cancel: 'sales.quotation.cancel',
} as const;
export type QuotationPermission = (typeof QUOTATION_PERMISSIONS)[keyof typeof QUOTATION_PERMISSIONS];
export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

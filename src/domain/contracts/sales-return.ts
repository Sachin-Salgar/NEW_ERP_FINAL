export const SALES_RETURN_PERMISSIONS = {
  read: 'sales.return.read', create: 'sales.return.create', update: 'sales.return.update',
  inspect: 'sales.return.inspect', approve: 'sales.return.approve', reject: 'sales.return.reject',
  process: 'sales.return.process', cancel: 'sales.return.cancel', close: 'sales.return.close',
} as const;
export type SalesReturnPermission = (typeof SALES_RETURN_PERMISSIONS)[keyof typeof SALES_RETURN_PERMISSIONS];
export type SalesReturnStatus = 'REQUESTED' | 'INSPECTED' | 'APPROVED' | 'PROCESSED' | 'CLOSED' | 'REJECTED' | 'CANCELLED';

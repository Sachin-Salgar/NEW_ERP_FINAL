export const ORDER_PERMISSIONS = {
  read: 'sales.order.read',
  create: 'sales.order.create',
  update: 'sales.order.update',
  delete: 'sales.order.delete',
  confirm: 'sales.order.confirm',
  cancel: 'sales.order.cancel',
  close: 'sales.order.close',
} as const;
export const SALES_MODULE_CODE = 'sales';
export type OrderPermission = (typeof ORDER_PERMISSIONS)[keyof typeof ORDER_PERMISSIONS];
export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'CLOSED';

export const CUSTOMER_MODULE_CODE = 'crm';

export const CUSTOMER_PERMISSIONS = {
  read: 'customer.read',
  create: 'customer.create',
  update: 'customer.update',
  delete: 'customer.delete',
} as const;

export type CustomerPermission = (typeof CUSTOMER_PERMISSIONS)[keyof typeof CUSTOMER_PERMISSIONS];

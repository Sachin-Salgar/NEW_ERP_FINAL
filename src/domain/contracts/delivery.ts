export const DELIVERY_PERMISSIONS = {
  read: 'sales.delivery.read',
  create: 'sales.delivery.create',
  update: 'sales.delivery.update',
  dispatch: 'sales.delivery.dispatch',
  deliver: 'sales.delivery.deliver',
  complete: 'sales.delivery.complete',
  cancel: 'sales.delivery.cancel',
} as const;

export type DeliveryPermission = (typeof DELIVERY_PERMISSIONS)[keyof typeof DELIVERY_PERMISSIONS];
export type DeliveryStatus = 'DRAFT' | 'DISPATCHED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';

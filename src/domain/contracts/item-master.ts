export const ITEM_MASTER_MODULE_CODE = 'inventory';

export const ITEM_MASTER_PERMISSIONS = {
  read: 'inventory.item.read',
  create: 'inventory.item.create',
  update: 'inventory.item.update',
  delete: 'inventory.item.delete',
} as const;

export type ItemMasterPermission = (typeof ITEM_MASTER_PERMISSIONS)[keyof typeof ITEM_MASTER_PERMISSIONS];

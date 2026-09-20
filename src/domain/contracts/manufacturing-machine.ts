export const MANUFACTURING_MODULE_CODE = 'manufacturing' as const;

export const MACHINE_PERMISSIONS = {
  read: 'manufacturing.machine.read',
  create: 'manufacturing.machine.create',
  update: 'manufacturing.machine.update',
  delete: 'manufacturing.machine.delete',
} as const;

export type MachinePermission = (typeof MACHINE_PERMISSIONS)[keyof typeof MACHINE_PERMISSIONS];
export type MachineStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

export interface MachineRecord {
  id: string; tenantId: string; branchId: string; code: string; name: string;
  serialNumber: string | null; model: string | null; manufacturer: string | null;
  manufactureYear: number | null; section: string | null; division: string | null;
  operationalGroup: string | null; capacity: number | null; capacityUom: string | null;
  power: number | null; powerUom: string | null; cutTimeApplicable: boolean;
  productionMachine: boolean; fixedAssetId: string | null; status: MachineStatus;
  isDeleted: boolean; version: number; createdAt: Date; createdBy: string | null;
  updatedAt: Date | null; updatedBy: string | null;
}

export interface MachineRepository {
  create(input: Record<string, unknown>): Promise<MachineRecord>;
  getById(tenantId: string, id: string, branchId?: string): Promise<MachineRecord | null>;
  list(tenantId: string, query: { branchId?: string; page: number; pageSize: number; search?: string; status?: MachineStatus }): Promise<{ items: MachineRecord[]; total: number }>;
  update(input: Record<string, unknown>): Promise<MachineRecord | null>;
  softDelete(input: Record<string, unknown>): Promise<MachineRecord | null>;
}

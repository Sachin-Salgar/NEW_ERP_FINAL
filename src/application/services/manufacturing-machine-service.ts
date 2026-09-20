import { validate as isUuid } from 'uuid';
import type { AuditLogger } from '../contracts/audit.js';
import type { AuthorizationService } from './authorization-service.js';
import type { ModuleAccessService } from './module-access-service.js';
import { MACHINE_PERMISSIONS, MANUFACTURING_MODULE_CODE, type MachinePermission, type MachineRecord, type MachineRepository, type MachineStatus } from '../../domain/contracts/manufacturing-machine.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';

export interface MachineContext { tenantId: string; branchId: string; userId: string; }

export class ManufacturingMachineService {
  constructor(
    private readonly repository: MachineRepository,
    private readonly authorizationService: Pick<AuthorizationService, 'hasPermission'>,
    private readonly moduleAccessService: Pick<ModuleAccessService, 'isModuleEnabled'>,
    private readonly auditLogger: AuditLogger,
    private readonly transactionRunner: { runInTransaction<T>(callback: () => Promise<T>): Promise<T> },
  ) {}

  async create(context: MachineContext, input: Record<string, unknown>): Promise<MachineRecord> {
    await this.authorize(context, MACHINE_PERMISSIONS.create);
    const normalized = this.validateInput(input);
    return this.transactionRunner.runInTransaction(async () => {
      const machine = await this.repository.create({ ...context, ...normalized, actorUserId: context.userId });
      await this.auditLogger.record({ tenantId: context.tenantId, actorUserId: context.userId, action: 'manufacturing.machine.created', resourceType: 'manufacturing_machine', resourceId: machine.id, outcome: 'success' }, { requireTransaction: true });
      return machine;
    });
  }

  async get(context: MachineContext, id: string): Promise<MachineRecord> {
    await this.authorize(context, MACHINE_PERMISSIONS.read);
    const machine = await this.repository.getById(context.tenantId, this.id(id), context.branchId);
    if (!machine) throw new NotFoundError('Machine not found.');
    return machine;
  }

  async list(context: MachineContext, input: { page?: number; pageSize?: number; search?: string; status?: MachineStatus } = {}) {
    await this.authorize(context, MACHINE_PERMISSIONS.read);
    const page = input.page ?? 1, pageSize = input.pageSize ?? 20;
    if (!Number.isInteger(page) || page < 1) throw new ValidationError('Page must be a positive integer.');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new ValidationError('Page size must be between 1 and 100.');
    return this.repository.list(context.tenantId, { ...input, page, pageSize, branchId: context.branchId });
  }

  async update(context: MachineContext, id: string, input: Record<string, unknown>): Promise<MachineRecord> {
    await this.authorize(context, MACHINE_PERMISSIONS.update);
    const machineId = this.id(id);
    const expectedVersion = Number(input.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new ValidationError('Expected version must be a positive integer.');
    const normalized = this.validateInput(input);
    return this.transactionRunner.runInTransaction(async () => {
      const machine = await this.repository.update({ ...context, ...normalized, machineId, expectedVersion, actorUserId: context.userId });
      if (!machine) throw new NotFoundError('Machine not found or version is stale.');
      await this.auditLogger.record({ tenantId: context.tenantId, actorUserId: context.userId, action: 'manufacturing.machine.updated', resourceType: 'manufacturing_machine', resourceId: machine.id, outcome: 'success' }, { requireTransaction: true });
      return machine;
    });
  }

  async softDelete(context: MachineContext, id: string, expectedVersion: number): Promise<MachineRecord> {
    await this.authorize(context, MACHINE_PERMISSIONS.delete);
    const machineId = this.id(id);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new ValidationError('Expected version must be a positive integer.');
    return this.transactionRunner.runInTransaction(async () => {
      const machine = await this.repository.softDelete({ ...context, machineId, expectedVersion, actorUserId: context.userId });
      if (!machine) throw new NotFoundError('Machine not found or version is stale.');
      await this.auditLogger.record({ tenantId: context.tenantId, actorUserId: context.userId, action: 'manufacturing.machine.deleted', resourceType: 'manufacturing_machine', resourceId: machine.id, outcome: 'success' }, { requireTransaction: true });
      return machine;
    });
  }

  private async authorize(context: MachineContext, permission: MachinePermission) {
    if (!isUuid(context.tenantId) || !isUuid(context.branchId) || !isUuid(context.userId)) throw new ValidationError('Valid tenant, branch, and user context is required.');
    if (!(await this.moduleAccessService.isModuleEnabled(context.tenantId, MANUFACTURING_MODULE_CODE))) throw new ForbiddenError('Manufacturing module is not enabled for this tenant.');
    if (!(await this.authorizationService.hasPermission(context.tenantId, context.userId, permission))) throw new ForbiddenError('Insufficient permission for Machine Master operation.');
  }

  private id(value: string) { if (!isUuid(value)) throw new ValidationError('A valid UUID is required.'); return value; }

  private validateInput(input: Record<string, unknown>) {
    const code = typeof input.code === 'string' ? input.code.trim().toUpperCase() : undefined;
    const name = typeof input.name === 'string' ? input.name.trim() : undefined;
    if (code !== undefined && (!code || code.length > 50)) throw new ValidationError('Machine code is required and must be at most 50 characters.');
    if (name !== undefined && (!name || name.length > 255)) throw new ValidationError('Machine name is required and must be at most 255 characters.');
    if (input.manufactureYear != null && (!Number.isInteger(Number(input.manufactureYear)) || Number(input.manufactureYear) < 1900 || Number(input.manufactureYear) > new Date().getFullYear() + 1)) throw new ValidationError('Manufacture year is invalid.');
    for (const field of ['capacity', 'power']) if (input[field] != null && (!Number.isFinite(Number(input[field])) || Number(input[field]) < 0)) throw new ValidationError(field + ' must be a non-negative number.');
    const status = String(input.status ?? 'ACTIVE');
    if (!['ACTIVE', 'INACTIVE', 'MAINTENANCE'].includes(status)) throw new ValidationError('Invalid machine status.');
    return { ...input, code, name, manufactureYear: input.manufactureYear == null ? null : Number(input.manufactureYear), capacity: input.capacity == null ? null : Number(input.capacity), power: input.power == null ? null : Number(input.power), cutTimeApplicable: input.cutTimeApplicable !== false, productionMachine: input.productionMachine === true, status: status as MachineStatus };
  }
}

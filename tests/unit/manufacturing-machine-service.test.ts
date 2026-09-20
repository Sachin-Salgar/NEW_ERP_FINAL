import { describe, expect, it, vi } from 'vitest';
import { ManufacturingMachineService } from '../../src/application/services/manufacturing-machine-service.js';

const context = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  branchId: '22222222-2222-4222-8222-222222222222',
  userId: '33333333-3333-4333-8333-333333333333',
};

function service(repository: Record<string, unknown>) {
  return new ManufacturingMachineService(
    repository as never,
    { hasPermission: vi.fn().mockResolvedValue(true) },
    { isModuleEnabled: vi.fn().mockResolvedValue(true) },
    { record: vi.fn().mockResolvedValue(undefined) } as never,
    { runInTransaction: async <T>(callback: () => Promise<T>) => callback() },
  );
}

describe('ManufacturingMachineService', () => {
  it('creates a machine master with normalized defaults', async () => {
    const machine = {
      id: '44444444-4444-4444-8444-444444444444',
      ...context,
      code: 'LASER-01',
      name: 'Laser Welding Machine',
      status: 'ACTIVE',
      cutTimeApplicable: true,
      productionMachine: true,
    };
    const repository = { create: vi.fn().mockResolvedValue(machine) };
    await expect(service(repository).create(context, {
      code: ' laser-01 ',
      name: ' Laser Welding Machine ',
      productionMachine: true,
    })).resolves.toMatchObject({ code: 'LASER-01', status: 'ACTIVE', productionMachine: true });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      code: 'LASER-01',
      name: 'Laser Welding Machine',
      cutTimeApplicable: true,
    }));
  });

  it('rejects invalid manufacture year and stale updates', async () => {
    const repository = {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(null),
    };
    await expect(service(repository).create(context, { code: 'M1', name: 'Machine', manufactureYear: 1800 }))
      .rejects.toThrow('Manufacture year is invalid.');
    await expect(service(repository).update(context, '44444444-4444-4444-8444-444444444444', {
      name: 'Machine', expectedVersion: 1,
    })).rejects.toThrow('Machine not found or version is stale.');
  });

  it('requires manufacturing module and permission', async () => {
    const repository = { list: vi.fn() };
    const disabled = new ManufacturingMachineService(
      repository as never,
      { hasPermission: vi.fn().mockResolvedValue(true) },
      { isModuleEnabled: vi.fn().mockResolvedValue(false) },
      { record: vi.fn() } as never,
      { runInTransaction: async <T>(callback: () => Promise<T>) => callback() },
    );
    await expect(disabled.list(context)).rejects.toThrow('Manufacturing module is not enabled');
  });
});

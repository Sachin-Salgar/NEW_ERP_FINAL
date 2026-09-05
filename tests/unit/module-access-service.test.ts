import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/infrastructure/database/tenant-context.js', () => ({
  withTenantContext: async (
    _pool: unknown,
    _tenantContextKey: string,
    _tenantId: string,
    callback: (client: unknown) => Promise<unknown>,
  ) => callback((globalThis as { __moduleAccessClient?: unknown }).__moduleAccessClient),
}));

import { ModuleAccessService } from '../../src/application/services/module-access-service.js';

const moduleRow = {
  id: 'module-1',
  code: 'sales',
  name: 'Sales',
  moduleGroup: 'Sales',
  description: null,
  icon: null,
  route: '/sales',
  isCore: false,
  sortOrder: 30,
};

function createService(rows: Array<{ rows: unknown[] }>) {
  const query = vi.fn();
  for (const result of rows) query.mockResolvedValueOnce(result);
  (globalThis as { __moduleAccessClient?: unknown }).__moduleAccessClient = { query };
  return { service: new ModuleAccessService({} as never), query };
}

describe('ModuleAccessService', () => {
  it('returns enabled=true for every accessible module', async () => {
    const { service } = createService([{ rows: [moduleRow] }]);

    await expect(service.listAccessibleModules('tenant-1', 'organization-1')).resolves.toEqual([
      { ...moduleRow, enabled: true },
    ]);
  });

  it('returns enabled=true when enabling an organization module', async () => {
    const { service } = createService([
      { rows: [moduleRow] },
      { rows: [{ enabled: true }] },
    ]);

    await expect(
      service.setOrganizationModule('tenant-1', 'organization-1', 'sales', true, 'user-1'),
    ).resolves.toEqual({ ...moduleRow, enabled: true });
  });

  it('returns null when disabling an organization module', async () => {
    const { service } = createService([
      { rows: [moduleRow] },
      { rows: [{ enabled: false }] },
    ]);

    await expect(
      service.setOrganizationModule('tenant-1', 'organization-1', 'sales', false, 'user-1'),
    ).resolves.toBeNull();
  });
});

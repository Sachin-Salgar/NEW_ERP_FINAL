import { describe, expect, it, vi } from 'vitest';
import { v7 } from 'uuid';

import { TenantContextService } from '../../src/application/services/tenant-context-service.js';

describe('TenantContextService', () => {
  it('binds a valid tenant UUID to the provider', async () => {
    const tenantId = v7();
    const setTenantContext = vi.fn(async () => undefined);
    const service = new TenantContextService({
      getCurrentTenantId: async () => tenantId,
      setTenantContext,
      withTenantContext: async (_tenantId, callback) => callback({} as never),
      clearTenantContext: async () => undefined,
    });

    await service.bindTenant(tenantId);

    expect(setTenantContext).toHaveBeenCalledWith(tenantId);
  });

  it('rejects invalid tenant identifiers', async () => {
    const service = new TenantContextService({
      getCurrentTenantId: async () => undefined,
      setTenantContext: async () => undefined,
      withTenantContext: async (_tenantId, callback) => callback({} as never),
      clearTenantContext: async () => undefined,
    });

    await expect(service.bindTenant('invalid-tenant')).rejects.toThrow('Invalid tenant identifier');
  });
});

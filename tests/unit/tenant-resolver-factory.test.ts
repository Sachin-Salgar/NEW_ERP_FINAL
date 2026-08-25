import { describe, it, expect } from 'vitest';
import { createTenantResolver } from '../../src/application/services/tenant-resolver-factory.js';

// Minimal repository stub matching TenantResolutionRepository shape used by the factory
const stubRepo = {
  getTenantById: async (id: string) => null,
  findTenantByHost: async (host: string) => null,
  findUserOrganizationMemberships: async (tenantId: string, userId: string) => [],
};

describe('TenantResolver factory', () => {
  it('returns an object implementing resolveTenantFromHost and resolveUserMemberships', async () => {
    const resolver = createTenantResolver(stubRepo as any, {});
    expect(typeof resolver.resolveTenantFromHost).toBe('function');
    expect(typeof resolver.resolveUserMemberships).toBe('function');
    expect(typeof resolver.resolveOnPremTenant).toBe('function');
  });
});

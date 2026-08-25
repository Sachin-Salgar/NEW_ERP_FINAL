import { describe, it, expect } from 'vitest';
import { createTenantResolver } from '../../src/application/services/tenant-resolver-factory.js';

const makeRepo = (tenantsById: Record<string, any> = {}, tenantsByHost: Record<string, any> = {}) => ({
  getTenantById: async (id: string) => tenantsById[id] ?? null,
  findTenantByHost: async (host: string) => tenantsByHost[host] ?? null,
  findUserOrganizationMemberships: async () => [],
});

describe('TenantResolver strategies (factory)', () => {
  it('selects OnPremInstallation strategy when DEPLOYMENT_TENANT_ID is set', async () => {
    const repo = makeRepo({ 'MAGOD001': { id: 'MAGOD001', name: 'Magod', subdomain: 'magod', slug: 'magod', status: 'active' } });
    const resolver = createTenantResolver(repo as any, { DEPLOYMENT_TENANT_ID: 'MAGOD001' });
    const tenant = await resolver.resolveOnPremTenant();
    expect(tenant.id).toBe('MAGOD001');
  });

  it('throws when DEPLOYMENT_TENANT_ID is missing for on-prem resolver', async () => {
    const repo = makeRepo();
    const resolver = createTenantResolver(repo as any, { TENANT_RESOLUTION_MODE: 'on_premises' });
    await expect(resolver.resolveOnPremTenant()).rejects.toBeTruthy();
  });

  it('selects Development strategy when NODE_ENV=development', async () => {
    const host = 'magod.localhost';
    const repo = makeRepo({ 'MAGOD001': { id: 'MAGOD001', name: 'Magod', subdomain: 'magod', slug: 'magod', status: 'active' } });
    // Provide TENANT_HOST_MAP to map host to id
    const hostMap = JSON.stringify({ [host]: 'MAGOD001' });
    const resolver = createTenantResolver(repo as any, { NODE_ENV: 'development', TENANT_HOST_MAP: hostMap });
    const tenant = await resolver.resolveTenantFromHost(host);
    expect(tenant.id).toBe('MAGOD001');
  });

  it('throws for unknown development host', async () => {
    const host = 'unknown.localhost';
    const repo = makeRepo();
    const hostMap = JSON.stringify({});
    const resolver = createTenantResolver(repo as any, { NODE_ENV: 'development', TENANT_HOST_MAP: hostMap });
    await expect(resolver.resolveTenantFromHost(host)).rejects.toBeTruthy();
  });

  it('selects Saas strategy by default and resolves findTenantByHost', async () => {
    const host = 'magod.yourerp.com';
    const repo = makeRepo({}, { [host]: { id: 'MAGOD001', name: 'Magod', subdomain: 'magod', slug: 'magod', status: 'active' } });
    const resolver = createTenantResolver(repo as any, { NODE_ENV: 'production' });
    const tenant = await resolver.resolveTenantFromHost(host);
    expect(tenant.id).toBe('MAGOD001');
  });

  it('throws for unknown saas host', async () => {
    const host = 'unknown.yourerp.com';
    const repo = makeRepo();
    const resolver = createTenantResolver(repo as any, { NODE_ENV: 'production' });
    await expect(resolver.resolveTenantFromHost(host)).rejects.toBeTruthy();
  });

  it('explicit mode selection works for development/saas/on_premises', async () => {
    const host = 'magod.localhost';
    const repo = makeRepo({ 'MAGOD001': { id: 'MAGOD001', name: 'Magod', subdomain: 'magod', slug: 'magod', status: 'active' } }, { 'magod.yourerp.com': { id: 'MAGOD002', name: 'MagodProd', subdomain: 'magod', slug: 'magod', status: 'active' } });
    const hostMap = JSON.stringify({ [host]: 'MAGOD001' });

    const dev = createTenantResolver(repo as any, { TENANT_RESOLUTION_MODE: 'development', NODE_ENV: 'development', TENANT_HOST_MAP: hostMap });
    const devTenant = await dev.resolveTenantFromHost(host);
    expect(devTenant.id).toBe('MAGOD001');

    const saas = createTenantResolver(repo as any, { TENANT_RESOLUTION_MODE: 'saas' });
    const saasTenant = await saas.resolveTenantFromHost('magod.yourerp.com');
    expect(saasTenant.id).toBe('MAGOD002');

    const onpremRepo = makeRepo({ 'MAGOD003': { id: 'MAGOD003', name: 'MagodOnprem', subdomain: 'magod', slug: 'magod', status: 'active' } });
    const onprem = createTenantResolver(onpremRepo as any, { TENANT_RESOLUTION_MODE: 'on_premises', DEPLOYMENT_TENANT_ID: 'MAGOD003' });
    const onpremTenant = await onprem.resolveOnPremTenant();
    expect(onpremTenant.id).toBe('MAGOD003');
  });
});

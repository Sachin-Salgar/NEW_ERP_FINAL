import { TenantResolutionService, ResolvedTenant, TenantResolutionRepository } from './tenant-resolution-service.js';
import type { TenantStrategy } from './development-tenant-resolver.js';

export class SaasHostTenantResolverStrategy implements TenantStrategy {
  private readonly delegate: TenantResolutionService;

  constructor(repository: TenantResolutionRepository, deploymentConfig: { TENANT_HOST_MAP?: string; DEPLOYMENT_TENANT_ID?: string; NODE_ENV?: string } = {}) {
    this.delegate = new TenantResolutionService(repository, deploymentConfig);
  }

  async resolveTenantFromHost(host: string): Promise<ResolvedTenant> {
    return this.delegate.resolveTenantFromHost(host);
  }

  async resolveOnPremTenant(): Promise<ResolvedTenant> {
    return this.delegate.resolveOnPremTenant();
  }
}

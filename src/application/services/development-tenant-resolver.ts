import { TenantResolutionService, ResolvedTenant, TenantResolutionRepository } from './tenant-resolution-service.js';

export interface TenantStrategy {
  resolveTenantFromHost(host: string): Promise<ResolvedTenant>;
  resolveOnPremTenant(): Promise<ResolvedTenant>;
}

export class DevelopmentTenantResolverStrategy implements TenantStrategy {
  private readonly delegate: TenantResolutionService;
  constructor(repository: TenantResolutionRepository, deploymentConfig: { TENANT_HOST_MAP?: string; DEPLOYMENT_TENANT_ID?: string; NODE_ENV?: string } = {}) {
    this.delegate = new TenantResolutionService(repository, deploymentConfig);
  }

  async resolveTenantFromHost(host: string): Promise<ResolvedTenant> {
    // Development mapping may include a TENANT_HOST_MAP; delegate to existing logic to preserve semantics
    return this.delegate.resolveTenantFromHost(host);
  }

  async resolveOnPremTenant(): Promise<ResolvedTenant> {
    // In development mode, on-prem path can delegate as well
    return this.delegate.resolveOnPremTenant();
  }
}

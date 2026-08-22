import type { TenantResolutionRepository } from '../services/tenant-resolution-service.js';
import { TenantResolutionService } from './tenant-resolution-service.js';
import type { TenantResolver } from './tenant-resolver.js';
import { DevelopmentTenantResolverStrategy } from './development-tenant-resolver.js';
import { SaasHostTenantResolverStrategy } from './saas-host-tenant-resolver.js';
import { OnPremInstallationTenantResolverStrategy } from './onprem-installation-tenant-resolver.js';
import type { TenantStrategy } from './development-tenant-resolver.js';

export function createTenantResolver(repository: TenantResolutionRepository, deploymentConfig: { TENANT_HOST_MAP?: string; DEPLOYMENT_TENANT_ID?: string; NODE_ENV?: string; TENANT_RESOLUTION_MODE?: string } = {}): TenantResolutionService {
  // Determine resolver selection in a single composition boundary.
  const mode = (deploymentConfig.TENANT_RESOLUTION_MODE ?? '').trim();


  let strategyInstance: TenantStrategy;

  if (mode === 'development') {
    strategyInstance = new DevelopmentTenantResolverStrategy(repository, deploymentConfig);
  } else if (mode === 'on_premises' || mode === 'on-prem' || (deploymentConfig.DEPLOYMENT_TENANT_ID ?? '').trim()) {
    strategyInstance = new OnPremInstallationTenantResolverStrategy(repository, deploymentConfig);
  } else if (mode === 'saas') {
    strategyInstance = new SaasHostTenantResolverStrategy(repository, deploymentConfig);
  } else {
    // Default selection: prefer explicit DEPLOYMENT_TENANT_ID -> on-prem, else prefer NODE_ENV=development -> development, else saas
    if ((deploymentConfig.DEPLOYMENT_TENANT_ID ?? '').trim()) {
      strategyInstance = new OnPremInstallationTenantResolverStrategy(repository, deploymentConfig);
    } else if ((deploymentConfig.NODE_ENV ?? '').trim() === 'development') {
      strategyInstance = new DevelopmentTenantResolverStrategy(repository, deploymentConfig);
    } else {
      strategyInstance = new SaasHostTenantResolverStrategy(repository, deploymentConfig);
    }
  }

  // Compose an adapter that preserves the existing TenantResolutionService membership methods while delegating tenant resolution to the selected strategy.
  class TenantResolverAdapter extends TenantResolutionService {
      private readonly strategy: TenantStrategy;
      constructor() {
        super(repository, deploymentConfig);
        this.strategy = strategyInstance;
      }

      async resolveTenantFromHost(host: string) {
        return this.strategy.resolveTenantFromHost(host);
      }

      async resolveOnPremTenant() {
        return this.strategy.resolveOnPremTenant();
      }
    }

  return new TenantResolverAdapter();
}

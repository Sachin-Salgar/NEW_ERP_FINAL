import { validate as isUuid } from 'uuid';

import { TenantContextProviderPort } from '../contracts/tenant-context-provider.js';
import { TenantContextError } from '../../domain/errors.js';

export class TenantContextService {
  constructor(private readonly tenantContextProvider: TenantContextProviderPort) {}

  async bindTenant(tenantId: string): Promise<void> {
    const candidate = tenantId?.trim();

    if (!candidate || !isUuid(candidate)) {
      throw new TenantContextError(`Invalid tenant identifier: ${tenantId}`);
    }

    await this.tenantContextProvider.setTenantContext(candidate);
  }

  async getCurrentTenantId(): Promise<string | undefined> {
    return this.tenantContextProvider.getCurrentTenantId();
  }

  async clearTenantContext(): Promise<void> {
    await this.tenantContextProvider.clearTenantContext();
  }
}

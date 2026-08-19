import { v7 as uuidV7 } from 'uuid';

import type { TenantBootstrapInput, TenantBootstrapResult } from '../../domain/contracts/bootstrap.js';
import type { PasswordHasher, TenantBootstrapServicePort } from '../contracts/security.js';
import type { TenantBootstrapRepository } from '../contracts/security.js';

export class TenantBootstrapService implements TenantBootstrapServicePort {
  constructor(
    private readonly tenantBootstrapRepository: TenantBootstrapRepository,
    private readonly passwordHasher?: PasswordHasher,
  ) {}

  async bootstrapTenant(input: TenantBootstrapInput): Promise<TenantBootstrapResult> {
    const tenantId = input.tenant.id ?? uuidV7();
    const organizationId = input.organization.id ?? uuidV7();
    const branchId = input.branch.id ?? uuidV7();
    const adminId = input.administrator.id ?? uuidV7();
    const roleId = input.role.id ?? uuidV7();

    const passwordHash = this.passwordHasher ? await this.passwordHasher.hash(input.administrator.password) : input.administrator.password;

    const normalizedInput: TenantBootstrapInput = {
      ...input,
      tenant: {
        ...input.tenant,
        id: tenantId,
      },
      organization: {
        ...input.organization,
        id: organizationId,
      },
      branch: {
        ...input.branch,
        id: branchId,
      },
      administrator: {
        ...input.administrator,
        id: adminId,
        password: passwordHash,
      },
      role: {
        ...input.role,
        id: roleId,
      },
    };

    const res = await this.tenantBootstrapRepository.bootstrapTenant(normalizedInput);
    return res;
  }
}

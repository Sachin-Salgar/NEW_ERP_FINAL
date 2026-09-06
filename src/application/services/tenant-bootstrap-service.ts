import { v7 as uuidV7 } from 'uuid';
import type { TenantBootstrapInput, TenantBootstrapResult } from '../../domain/contracts/bootstrap.js';
import type { PasswordHasher, TenantBootstrapServicePort } from '../contracts/security.js';
import type { TenantBootstrapRepository } from '../contracts/security.js';
import type { TransactionRunner } from '../contracts/transaction.js';

const normalizeBootstrapPermissions = (permissions: string[]): string[] => {
  const normalized = new Set<string>();
  for (const permission of permissions) {
    if (permission === 'user.manage') {
      normalized.add('user.read');
      normalized.add('user.create');
      normalized.add('user.update');
      normalized.add('user.activate');
      normalized.add('user.deactivate');
      continue;
    }
    normalized.add(permission);
  }
  return [...normalized];
};

export class TenantBootstrapService implements TenantBootstrapServicePort {
  constructor(private readonly tenantBootstrapRepository: TenantBootstrapRepository, private readonly passwordHasher?: PasswordHasher, private readonly transactionRunner?: TransactionRunner) {}
  async bootstrapTenant(input: TenantBootstrapInput): Promise<TenantBootstrapResult> {
    const tenantId = input.tenant.id ?? uuidV7();
    const organizationId = input.organization.id ?? uuidV7();
    const branchId = input.branch.id ?? uuidV7();
    const adminId = input.administrator.id ?? uuidV7();
    const roleId = input.role.id ?? uuidV7();
    const passwordHash = this.passwordHasher ? await this.passwordHasher.hash(input.administrator.password) : input.administrator.password;
    const normalizedInput: TenantBootstrapInput = {
      ...input,
      permissions: normalizeBootstrapPermissions(input.permissions),
      tenant: { ...input.tenant, id: tenantId },
      organization: { ...input.organization, id: organizationId },
      branch: { ...input.branch, id: branchId },
      administrator: { ...input.administrator, id: adminId, password: passwordHash },
      role: { ...input.role, id: roleId },
    };
    const bootstrap = () => this.tenantBootstrapRepository.bootstrapTenant(normalizedInput);
    return this.transactionRunner ? this.transactionRunner.runInTransaction(bootstrap) : bootstrap();
  }
}

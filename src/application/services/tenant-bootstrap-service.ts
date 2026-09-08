import { v7 as uuidV7 } from 'uuid';
import type { TenantBootstrapInput, TenantBootstrapResult } from '../../domain/contracts/bootstrap.js';
import type { PasswordHasher, TenantBootstrapServicePort } from '../contracts/security.js';
import type { TenantBootstrapRepository } from '../contracts/security.js';
import type { TransactionRunner } from '../contracts/transaction.js';

const normalizeBootstrapPermissions = (permissions: string[]): string[] => {
  const normalized = new Set<string>();
  for (const permission of permissions) {
    const replacements: Record<string, string[]> = {
      'user.manage': ['user.read', 'user.create', 'user.update', 'user.activate', 'user.deactivate'],
      'branch.manage': ['branch.read', 'branch.create', 'branch.update', 'branch.deactivate'],
      'role.manage': [
        'role.read',
        'role.create',
        'role.update',
        'role_permission.read',
        'role_permission.grant',
        'role_permission.revoke',
      ],
      'permission.manage': ['permission.read'],
    };
    for (const replacement of replacements[permission] ?? [permission]) normalized.add(replacement);
  }
  return [...normalized];
};

export class TenantBootstrapService implements TenantBootstrapServicePort {
  constructor(
    private readonly tenantBootstrapRepository: TenantBootstrapRepository,
    private readonly passwordHasher?: PasswordHasher,
    private readonly transactionRunner?: TransactionRunner,
  ) {}
  async bootstrapTenant(input: TenantBootstrapInput): Promise<TenantBootstrapResult> {
    const tenantId = input.tenant.id ?? uuidV7();
    const branchId = input.branch.id ?? uuidV7();
    const adminId = input.administrator.id ?? uuidV7();
    const roleId = input.role.id ?? uuidV7();
    const passwordHash = this.passwordHasher
      ? await this.passwordHasher.hash(input.administrator.password)
      : input.administrator.password;
    const normalizedInput: TenantBootstrapInput = {
      ...input,
      permissions: normalizeBootstrapPermissions(input.permissions),
      tenant: { ...input.tenant, id: tenantId },
      branch: { ...input.branch, id: branchId },
      administrator: { ...input.administrator, id: adminId, password: passwordHash },
      role: { ...input.role, id: roleId },
    };
    const bootstrap = () => this.tenantBootstrapRepository.bootstrapTenant(normalizedInput);
    return this.transactionRunner ? this.transactionRunner.runInTransaction(bootstrap) : bootstrap();
  }
}

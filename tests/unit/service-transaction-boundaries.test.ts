import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantBootstrapService } from '../../src/application/services/tenant-bootstrap-service.js';
import { UserRegistrationService } from '../../src/application/services/user-registration-service.js';

const runInTransactionSpy = vi.fn();
const transactionRunner = {
  runInTransaction<T>(callback: () => Promise<T>): Promise<T> {
    runInTransactionSpy();
    return callback();
  },
};

beforeEach(() => {
  runInTransactionSpy.mockClear();
});

describe('service transaction boundaries', () => {
  it('wraps tenant bootstrap repository orchestration in a transaction', async () => {
    const repository = {
      bootstrapTenant: vi.fn(async (input: any) => ({
        tenantId: input.tenant.id,
        organizationId: input.organization.id,
        branchId: input.branch.id,
        userId: input.administrator.id,
        roleId: input.role.id,
      })),
    };
    const service = new TenantBootstrapService(repository, undefined, transactionRunner);

    const input: any = {
      tenant: { name: 'Tenant' },
      organization: { name: 'Organization' },
      branch: { name: 'Branch' },
      administrator: { username: 'admin', email: 'admin@example.com', password: 'Password123!' },
      role: { code: 'admin', name: 'Administrator' },
      permissions: [],
      subscriptionPlanName: 'Starter',
      initialFinancialYear: { name: 'FY', startDate: '2026-04-01', endDate: '2027-03-31' },
    };

    await service.bootstrapTenant(input);

    expect(runInTransactionSpy).toHaveBeenCalledTimes(1);
    expect(repository.bootstrapTenant).toHaveBeenCalledTimes(1);
  });

  it('wraps user creation and role/access assignments in a transaction', async () => {
    const repository = {
      findById: vi.fn(async () => ({
        id: 'actor', tenantId: 'tenant', organizationId: 'org', defaultBranchId: 'branch',
        username: 'actor', email: 'actor@example.com', passwordHash: 'hash', status: 'active',
      })),
      findByTenantAndIdentifier: vi.fn(async () => null),
      findRoleByTenantAndCode: vi.fn(async () => ({ id: 'role', tenantId: 'tenant', code: 'member', name: 'Member' })),
      createRole: vi.fn(),
      createUser: vi.fn(async (input: any) => ({
        id: input.id, tenantId: input.tenantId, organizationId: input.organizationId,
        defaultBranchId: input.defaultBranchId, username: input.username, email: input.email, status: input.status,
      })),
      assignUserToOrganization: vi.fn(async () => true),
      assignUserRole: vi.fn(async () => undefined),
    };
    const passwordHasher = { hash: vi.fn(async () => 'password-hash'), verify: vi.fn(async () => true) };
    const service = new UserRegistrationService(repository, passwordHasher, undefined, transactionRunner);

    const result = await service.registerUser('tenant', 'actor', {
      username: 'new-user',
      email: 'new@example.com',
      password: 'Password123!',
    });

    expect(result.username).toBe('new-user');
    expect(runInTransactionSpy).toHaveBeenCalledTimes(1);
    expect(repository.createUser).toHaveBeenCalledTimes(1);
    expect(repository.assignUserToOrganization).toHaveBeenCalledTimes(1);
    expect(repository.assignUserRole).toHaveBeenCalledTimes(1);
  });

  it('propagates transaction failure without returning a partially created user', async () => {
    const failure = new Error('transaction failed');
    const failingRunner = {
      async runInTransaction<T>(_callback: () => Promise<T>): Promise<T> {
        throw failure;
      },
    };
    const repository = {
      findById: vi.fn(async () => ({
        id: 'actor', tenantId: 'tenant', organizationId: 'org', defaultBranchId: 'branch',
        username: 'actor', email: 'actor@example.com', passwordHash: 'hash', status: 'active',
      })),
      findByTenantAndIdentifier: vi.fn(async () => null),
      findRoleByTenantAndCode: vi.fn(async () => ({ id: 'role', tenantId: 'tenant', code: 'member', name: 'Member' })),
      createRole: vi.fn(),
      createUser: vi.fn(),
      assignUserToOrganization: vi.fn(),
      assignUserRole: vi.fn(),
    };
    const passwordHasher = { hash: vi.fn(async () => 'password-hash'), verify: vi.fn(async () => true) };
    const service = new UserRegistrationService(repository, passwordHasher, undefined, failingRunner);

    await expect(service.registerUser('tenant', 'actor', {
      username: 'new-user', email: 'new@example.com', password: 'Password123!',
    })).rejects.toBe(failure);
  });
});

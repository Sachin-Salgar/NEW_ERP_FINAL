import { describe, expect, it, vi } from 'vitest';

import { AuthenticationService } from '../../src/application/services/authentication-service.js';

const user = (tenantId: string, userId: string) => ({
  id: userId,
  tenantId,
  organizationId: 'org-1',
  defaultBranchId: null,
  username: 'alice',
  email: 'alice@example.com',
  passwordHash: 'hash',
  status: 'active',
});

describe('identity-based tenant authentication', () => {
  it('discovers tenant from the authenticated login identity without a host', async () => {
    const repository = {
      findLoginCandidates: vi.fn(async () => [{ userId: 'user-1', tenantId: 'tenant-1' }]),
      findById: vi.fn(async (tenantId: string, userId: string) => user(tenantId, userId)),
      createSession: vi.fn(async (input: any) => ({
        id: input.id,
        tenantId: input.tenantId,
        userId: input.userId,
        organizationId: input.organizationId,
        locationId: input.locationId,
        branchId: input.branchId,
        isActive: true,
        expiresAt: input.expiresAt,
        loginAt: new Date(),
      })),
    } as any;
    const passwordHasher = { verify: vi.fn(async () => true), hash: vi.fn() } as any;
    const tokenService = {
      createAccessToken: vi.fn(() => 'access-token'),
      createRefreshToken: vi.fn(() => 'refresh-token'),
      hashTokenValue: vi.fn(() => 'refresh-hash'),
    } as any;

    const service = new AuthenticationService(repository, passwordHasher, tokenService);
    const result = await service.authenticate('alice@example.com', 'password');

    expect(result.success).toBe(true);
    expect(result.user?.tenantId).toBe('tenant-1');
    expect(repository.findLoginCandidates).toHaveBeenCalledWith('alice@example.com');
    expect(repository.findById).toHaveBeenCalledWith('tenant-1', 'user-1');
  });

  it('uses the saved default location as the default session location when available', async () => {
    const repository = {
      findLoginCandidates: vi.fn(async () => [{ userId: 'user-1', tenantId: 'tenant-1' }]),
      findById: vi.fn(async (tenantId: string, userId: string) => ({
        ...user(tenantId, userId),
        defaultBranchId: 'branch-1',
        defaultLocationId: 'location-1',
      })),
      createSession: vi.fn(async (input: any) => ({
        id: input.id,
        tenantId: input.tenantId,
        userId: input.userId,
        organizationId: input.organizationId,
        locationId: input.locationId,
        branchId: input.branchId,
        isActive: true,
        expiresAt: input.expiresAt,
        loginAt: new Date(),
      })),
    } as any;
    const passwordHasher = { verify: vi.fn(async () => true), hash: vi.fn() } as any;
    const tokenService = {
      createAccessToken: vi.fn(() => 'access-token'),
      createRefreshToken: vi.fn(() => 'refresh-token'),
      hashTokenValue: vi.fn(() => 'refresh-hash'),
    } as any;

    const service = new AuthenticationService(repository, passwordHasher, tokenService);
    const result = await service.authenticate('alice@example.com', 'password');

    expect(result.success).toBe(true);
    expect(result.session?.locationId).toBe('location-1');
    expect(repository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: 'location-1', branchId: 'branch-1' }),
    );
  });

  it('fails closed when the same credentials match multiple active tenant accounts', async () => {
    const repository = {
      findLoginCandidates: vi.fn(async () => [
        { userId: 'user-1', tenantId: 'tenant-1' },
        { userId: 'user-2', tenantId: 'tenant-2' },
      ]),
      findById: vi.fn(async (tenantId: string, userId: string) => user(tenantId, userId)),
    } as any;
    const passwordHasher = { verify: vi.fn(async () => true), hash: vi.fn() } as any;
    const service = new AuthenticationService(repository, passwordHasher);

    const result = await service.authenticate('alice', 'password');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('INVALID_CREDENTIALS');
  });

  it('reloads the persisted session branch and financial year instead of user defaults', async () => {
    const repository = {
      findSession: vi.fn(async () => ({
        id: 'session-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        organizationId: 'org-1',
        locationId: 'location-1',
        branchId: 'branch-session',
        financialYearId: 'fy-session',
        isActive: true,
        expiresAt: new Date(Date.now() + 60_000),
        loginAt: new Date(),
        lastActivityAt: new Date(),
      })),
      findById: vi.fn(async () => ({
        ...user('tenant-1', 'user-1'),
        defaultBranchId: 'branch-default',
      })),
    } as any;
    const service = new AuthenticationService(repository, {} as any);

    await expect(service.validateSession('session-1', 'tenant-1')).resolves.toMatchObject({
      branchId: 'branch-session',
      financialYearId: 'fy-session',
    });
  });
});

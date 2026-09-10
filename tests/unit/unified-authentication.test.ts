import { describe, expect, it, vi } from 'vitest';

import { UnifiedAuthenticationService } from '../../src/application/services/unified-authentication-service.js';

const identityId = '00000000-0000-4000-8000-000000000001';
const tenantMembershipId = '00000000-0000-4000-8000-000000000002';
const platformMembershipId = '00000000-0000-4000-8000-000000000003';

function tenantContext() {
  return {
    contextType: 'tenant' as const,
    contextId: tenantMembershipId,
    tenantMembershipId,
    tenantId: '00000000-0000-4000-8000-000000000010',
    tenantName: 'Tenant One',
    userId: '00000000-0000-4000-8000-000000000011',
    user: {
      id: '00000000-0000-4000-8000-000000000011',
      identityId,
      tenantId: '00000000-0000-4000-8000-000000000010',
      defaultBranchId: null,
      username: 'alice',
      email: 'alice@example.com',
      status: 'active',
    },
    identitySecurityVersion: 1,
    membershipSecurityVersion: 1,
    tenantSecurityVersion: 1,
    userSecurityVersion: 1,
  };
}

function platformContext() {
  return {
    contextType: 'platform' as const,
    contextId: platformMembershipId,
    identityId,
    platformMembershipId,
    identitySecurityVersion: 1,
    membershipSecurityVersion: 1,
    platformSecurityVersion: 1,
  };
}

function buildService(contexts: any[]) {
  let challenge: any;
  const repository = {
    findLoginIdentity: vi.fn(async () => ({
      identityId,
      identitySecurityVersion: 1,
      secretHash: 'hash',
      failedAttemptCount: 0,
      lockedUntil: null,
    })),
    resolveUsableLoginContexts: vi.fn(async () => ({ identityId, identitySecurityVersion: 1, contexts })),
    authorizeTenantLoginContext: vi.fn(async () => contexts.find((context) => context.contextType === 'tenant')),
    authorizePlatformLoginContext: vi.fn(async () => contexts.find((context) => context.contextType === 'platform')),
    createPendingLoginChallenge: vi.fn(async (input: any) => {
      challenge = input;
      return input;
    }),
    createPlatformSession: vi.fn(async (input: any) => ({
      id: input.id,
      tenantId: null,
      userId: null,
      identityId,
      platformMembershipId: input.platformMembershipId,
      contextType: 'platform',
      isActive: true,
      expiresAt: input.expiresAt,
      loginAt: new Date(),
      lastActivityAt: new Date(),
    })),
    consumePendingLoginChallenge: vi.fn(async (_id: string, hash: string) => {
      if (!challenge || challenge.secretHash !== hash || challenge.consumed) return null;
      challenge.consumed = true;
      return { identityId, contextSnapshot: challenge.contextSnapshot };
    }),
    recordFailedIdentityLogin: vi.fn(),
    resetFailedIdentityLogin: vi.fn(),
  } as any;
  const tenantAuthenticationService = {
    authenticateTenantContext: vi.fn(async (context: any) => ({
      success: true,
      user: context.user,
      session: { id: 'session-1', tenantId: context.tenantId, expiresAt: new Date(), loginAt: new Date() },
      accessToken: 'access',
      refreshToken: 'refresh',
    })),
  } as any;
  const tokenService = {
    createAccessToken: vi.fn(() => 'access'),
    createRefreshToken: vi.fn(() => 'refresh'),
    hashTokenValue: vi.fn((value: string) => `hash:${value}`),
  } as any;
  const service = new UnifiedAuthenticationService(
    repository,
    { verify: vi.fn(async () => true), hash: vi.fn() },
    tokenService,
    tenantAuthenticationService,
  );
  return { service, repository, tenantAuthenticationService };
}

describe('unified authentication', () => {
  it('creates a tenant session directly for one usable context', async () => {
    const { service, tenantAuthenticationService } = buildService([tenantContext()]);
    const result = await service.authenticate('alice@example.com', 'password');
    expect(result.resolution).toBe('DIRECT');
    expect(result.context?.contextType).toBe('tenant');
    expect(result.context?.contextType).toBe('tenant');
    expect(result.authentication?.user).not.toHaveProperty('passwordHash');
    expect(result.authentication?.user).not.toHaveProperty('failedLoginCount');
    expect(result.authentication?.user).not.toHaveProperty('lockedUntil');
    expect(tenantAuthenticationService.authenticateTenantContext).toHaveBeenCalledOnce();
  });

  it('returns only a pending challenge for multiple usable contexts', async () => {
    const { service, repository, tenantAuthenticationService } = buildService([tenantContext(), platformContext()]);
    const result = await service.authenticate('alice@example.com', 'password');
    expect(result.resolution).toBe('SELECT');
    expect(result.pendingSelectionToken).toMatch(/^[0-9a-f-]+\.[A-Za-z0-9_-]+$/);
    expect(result.contexts).toHaveLength(2);
    expect(result.contexts).toContainEqual({
      type: 'platform',
      contextRef: expect.any(String),
      label: 'Platform administration',
    });
    expect(result).not.toHaveProperty('accessToken');
    expect(repository.createPendingLoginChallenge).toHaveBeenCalledOnce();
    expect(repository.createPlatformSession).not.toHaveBeenCalled();
    expect(tenantAuthenticationService.authenticateTenantContext).not.toHaveBeenCalled();
    expect(repository.resolveUsableLoginContexts).toHaveBeenCalledWith(identityId);
  });

  it('creates a platform session directly for one usable platform context', async () => {
    const { service, repository } = buildService([platformContext()]);
    const result = await service.authenticate('alice@example.com', 'password');
    expect(result.resolution).toBe('DIRECT');
    expect(result.context?.contextType).toBe('platform');
    expect(repository.createPlatformSession).toHaveBeenCalledOnce();
  });

  it('fails safely without a session when no usable contexts remain', async () => {
    const { service, tenantAuthenticationService } = buildService([]);
    const result = await service.authenticate('alice@example.com', 'password');
    expect(result.resolution).toBe('ZERO');
    expect(tenantAuthenticationService.authenticateTenantContext).not.toHaveBeenCalled();
  });

  it('atomically rejects replay after completing selection', async () => {
    const { service } = buildService([tenantContext(), platformContext()]);
    const login = await service.authenticate('alice@example.com', 'password');
    const contextRef = login.contexts!.find((context) => context.type === 'tenant')!.contextRef;
    const selected = await service.selectContext(login.pendingSelectionToken!, contextRef);
    expect(selected.resolution).toBe('DIRECT');
    const replay = await service.selectContext(login.pendingSelectionToken!, contextRef);
    expect(replay.resolution).toBe('ZERO');
  });

  it('rejects altered tokens, challenge IDs, and forged context references', async () => {
    const { service } = buildService([tenantContext(), platformContext()]);
    const login = await service.authenticate('alice@example.com', 'password');
    const contextRef = login.contexts!.find((context) => context.type === 'tenant')!.contextRef;
    expect((await service.selectContext(`${login.pendingSelectionToken}x`, contextRef)).resolution).toBe('ZERO');
    expect((await service.selectContext(login.pendingSelectionToken!, 'not-a-reference')).resolution).toBe('ZERO');
    expect((await service.selectContext(login.pendingSelectionToken!, Buffer.from(`tenant:${platformMembershipId}`, 'utf8').toString('base64url'))).resolution).toBe('ZERO');
  });

  it('fails closed when authoritative contexts change after challenge creation', async () => {
    const { service, repository } = buildService([tenantContext(), platformContext()]);
    const login = await service.authenticate('alice@example.com', 'password');
    const contextRef = login.contexts!.find((context) => context.type === 'tenant')!.contextRef;
    repository.resolveUsableLoginContexts.mockResolvedValueOnce({
      identityId,
      identitySecurityVersion: 2,
      contexts: [],
    });

    const selected = await service.selectContext(login.pendingSelectionToken!, contextRef);

    expect(selected.resolution).toBe('ZERO');
  });

  it('allows only one concurrent challenge consumption', async () => {
    const { service, repository } = buildService([tenantContext(), platformContext()]);
    const login = await service.authenticate('alice@example.com', 'password');
    const contextRef = login.contexts!.find((context) => context.type === 'tenant')!.contextRef;
    const originalConsume = repository.consumePendingLoginChallenge;
    repository.consumePendingLoginChallenge = vi.fn(async (...args: any[]) => {
      await Promise.resolve();
      return originalConsume(...args);
    });

    const results = await Promise.all([
      service.selectContext(login.pendingSelectionToken!, contextRef),
      service.selectContext(login.pendingSelectionToken!, contextRef),
    ]);

    expect(results.filter((result) => result.resolution === 'DIRECT')).toHaveLength(1);
    expect(results.filter((result) => result.resolution === 'ZERO')).toHaveLength(1);
  });
});

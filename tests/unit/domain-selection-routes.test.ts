import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

import branchRoutes from '../../src/presentation/http/routes/branch.js';
import locationRoutes from '../../src/presentation/http/routes/location.js';

async function buildApp() {
  const app = Fastify({ logger: false });
  app.decorate('appConfig', { isTest: true, AUTH_RATE_LIMIT_WINDOW_MS: 60_000 } as any);
  app.decorate('jwtTokenService', {
    verifyAccessToken: vi.fn(() => ({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      tokenType: 'access',
    })),
  } as any);
  app.decorate('authService', {
    validateSession: vi.fn(async () => ({
      id: 'user-1',
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      activeLocationId: 'location-1',
      defaultLocationId: 'location-1',
      defaultBranchId: 'branch-1',
      username: 'alice',
      email: 'alice@example.com',
      status: 'active',
    })),
  } as any);
  app.decorate('authorizationService', {
    hasPermission: vi.fn(async () => true),
  } as any);
  app.decorate('moduleAccessService', {
    isModuleEnabled: vi.fn(async () => true),
  } as any);
  app.decorate('branchService', {
    getAccessibleBranchByIdForUser: vi.fn(async () => ({
      id: 'branch-1',
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      name: 'Branch 1',
    })),
  } as any);
  app.decorate('locationService', {
    getAccessibleLocationByIdForUser: vi.fn(async () => ({
      id: 'location-1',
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      name: 'Location 1',
    })),
  } as any);
  await app.register(branchRoutes, { prefix: '/api/v1' });
  await app.register(locationRoutes, { prefix: '/api/v1' });
  await app.ready();
  return app;
}

describe('domain selection routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
  });

  it('returns a branch without creating an authentication session or tokens', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/branches/branch-1/select',
      headers: { authorization: 'Bearer valid-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      branch: {
        id: 'branch-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        name: 'Branch 1',
      },
    });
    expect(response.json()).not.toHaveProperty('accessToken');
    expect(response.json()).not.toHaveProperty('session');
  });

  it('returns a location without creating an authentication session or tokens', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/locations/location-1/select',
      headers: { authorization: 'Bearer valid-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      location: {
        id: 'location-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        name: 'Location 1',
      },
    });
    expect(response.json()).not.toHaveProperty('accessToken');
    expect(response.json()).not.toHaveProperty('session');
  });
});

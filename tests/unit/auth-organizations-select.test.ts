import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

import authRoutes from '../../src/presentation/http/routes/auth.js';
import { ForbiddenError, UnauthorizedError } from '../../src/domain/errors.js';

async function buildAuthApp(overrides: { tenantMembershipService?: any; authService?: any } = {}) {
  const app = Fastify({ logger: false });
  app.decorate('appConfig', {
    NODE_ENV: 'test', APP_NAME: 'new-erp-final', HOST: '127.0.0.1', PORT: 3000, API_PREFIX: '/api/v1', LOG_LEVEL: 'info',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test', DATABASE_POOL_MIN: 1, DATABASE_POOL_MAX: 2,
    JWT_SECRET: 'test-jwt-secret-1234567890abcd', JWT_ISSUER: 'new-erp-final', TENANT_CONTEXT_KEY: 'app.current_tenant_id',
    CORS_ALLOWED_ORIGINS: ['*'], isDevelopment: false, isTest: true, isProduction: false,
  } as any);
  app.decorate('tenantMembershipService', overrides.tenantMembershipService ?? {
    resolveOrganizationMemberships: vi.fn(async () => ({ organizations: [], activeOrganizationId: null, requiresOrganizationSelection: false })),
  });
  app.decorate('branchService', {
    getAccessibleBranchByIdForUser: vi.fn(async () => null),
  } as any);
  app.decorate('locationService', {
    getAccessibleLocationByIdForUser: vi.fn(async () => null),
  } as any);
  app.decorate('authService', overrides.authService ?? {
    validateSession: vi.fn(async () => null),
    createSessionForUser: vi.fn(),
  });
  app.decorate('jwtTokenService', {
    config: { JWT_SECRET: 'test-jwt-secret-1234567890abcd', JWT_ISSUER: 'new-erp-final' },
    createAccessToken: vi.fn(() => 'access-token'),
    createRefreshToken: vi.fn(() => 'refresh-token'),
    verifyAccessToken: vi.fn((token: string) => {
      if (token === 'valid-session-t1') {
        return {
          sub: 'user-1',
          tenantId: 'tenant-1',
          sessionId: 'session-1',
          tokenType: 'access' as const,
          iss: 'new-erp-final',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        } as any;
      }
      throw new UnauthorizedError('Invalid token.');
    }),
    verifyRefreshToken: vi.fn(() => ({
      sub: 'user-1',
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      tokenType: 'refresh' as const,
      iss: 'new-erp-final',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })),
    verifyToken: vi.fn((token: string) => {
      if (token === 'valid-session-t1') {
        return {
          sub: 'user-1',
          tenantId: 'tenant-1',
          sessionId: 'session-1',
          tokenType: 'access' as const,
          iss: 'new-erp-final',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        } as any;
      }
      throw new UnauthorizedError('Invalid token.');
    }),
    hashTokenValue: vi.fn((token: string) => `hash:${token}`),
  } as any);
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.ready();
  return app;
}

describe('POST /api/v1/auth/organizations/select', () => {
  let app: Awaited<ReturnType<typeof buildAuthApp>>;
  beforeEach(async () => { app = await buildAuthApp(); });

  it('creates a tenant-scoped organization session after membership validation', async () => {
    const tenantMembershipService = {
      resolveOrganizationMemberships: vi.fn(async () => ({
        organizations: [{ id: 'org-1', tenantId: 'tenant-1', code: 'ORG1', name: 'Org 1', status: 'active', isDefault: true }],
        activeOrganizationId: 'org-1', requiresOrganizationSelection: false,
      })),
    };
    const authService = {
      validateSession: vi.fn(async () => ({ id: 'user-1', tenantId: 'tenant-1', organizationId: 'org-1', defaultBranchId: null, username: 'alice', email: 'alice@example.com', status: 'active' })),
      createSessionForUser: vi.fn(async () => ({
        success: true,
        user: { id: 'user-1', tenantId: 'tenant-1', organizationId: 'org-1', defaultBranchId: null, username: 'alice', email: 'alice@example.com', status: 'active' },
        session: { id: 'session-2', tenantId: 'tenant-1', userId: 'user-1', organizationId: 'org-1', branchId: null, isActive: true, expiresAt: new Date(Date.now() + 60_000), loginAt: new Date() },
        accessToken: 'access-2', refreshToken: 'refresh-2',
      })),
    };
    await app.close();
    app = await buildAuthApp({ tenantMembershipService, authService });
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/organizations/select', headers: { authorization: 'Bearer valid-session-t1' }, payload: { organizationId: 'org-1' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().session.tenantId).toBe('tenant-1');
    expect(tenantMembershipService.resolveOrganizationMemberships).toHaveBeenCalledWith('tenant-1', 'user-1', 'org-1');
    expect(authService.createSessionForUser).toHaveBeenCalledWith('tenant-1', 'user-1', 'org-1');
  });

  it('rejects unauthorized organization selection without creating a session', async () => {
    const tenantMembershipService = { resolveOrganizationMemberships: vi.fn(async () => { throw new ForbiddenError('Requested organization is not available.'); }) };
    const authService = { validateSession: vi.fn(async () => ({ id: 'user-1', tenantId: 'tenant-1', organizationId: 'org-1', defaultBranchId: null, username: 'alice', email: 'alice@example.com', status: 'active' })), createSessionForUser: vi.fn() };
    await app.close();
    app = await buildAuthApp({ tenantMembershipService, authService });
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/organizations/select', headers: { authorization: 'Bearer valid-session-t1' }, payload: { organizationId: 'org-2' } });
    expect(response.statusCode).toBe(403);
    expect(authService.createSessionForUser).not.toHaveBeenCalled();
  });

  it('rejects a client attempt to change tenant through request headers because tenant comes from the session', async () => {
    const tenantMembershipService = { resolveOrganizationMemberships: vi.fn(async () => ({ organizations: [], activeOrganizationId: null, requiresOrganizationSelection: false })) };
    const authService = { validateSession: vi.fn(async () => ({ id: 'user-1', tenantId: 'tenant-1', organizationId: 'org-1', defaultBranchId: null, username: 'alice', email: 'alice@example.com', status: 'active' })), createSessionForUser: vi.fn() };
    await app.close();
    app = await buildAuthApp({ tenantMembershipService, authService });
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/organizations/select', headers: { authorization: 'Bearer valid-session-t1', 'x-tenant-id': 'tenant-2' }, payload: { organizationId: 'org-1' } });
    expect(response.statusCode).not.toBe(401);
    expect(authService.createSessionForUser).toHaveBeenCalledWith('tenant-1', 'user-1', 'org-1');
  });
});

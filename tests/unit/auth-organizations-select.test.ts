import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

import authRoutes from '../../src/presentation/http/routes/auth.js';
import { ForbiddenError, UnauthorizedError } from '../../src/domain/errors.js';

type AppDependencies = {
  tenantResolver?: any;
  authService?: any;
  jwtTokenService?: any;
};

async function buildAuthApp(deps: AppDependencies = {}) {
  const app = Fastify({ logger: false });

  app.decorate('appConfig', {
    NODE_ENV: 'test',
    APP_NAME: 'new-erp-final',
    HOST: 'tenant.example.com',
    PORT: 3000,
    API_PREFIX: '/api/v1',
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    DATABASE_POOL_MIN: 1,
    DATABASE_POOL_MAX: 2,
    JWT_SECRET: 'test-jwt-secret-1234567890abcd',
    JWT_ISSUER: 'new-erp-final',
    TENANT_HEADER: 'x-tenant-id',
    TENANT_CONTEXT_KEY: 'app.current_tenant_id',
    TENANT_HOST_MAP: '',
    DEPLOYMENT_TENANT_ID: '',
    CORS_ALLOWED_ORIGINS: ['*'],
    isDevelopment: false,
    isTest: true,
    isProduction: false,
  } as any);

  app.decorate('tenantResolver', deps.tenantResolver ?? {
    resolveUserMemberships: vi.fn(),
  });

  app.decorate('authService', deps.authService ?? {
    validateSession: vi.fn(),
    createSessionForUser: vi.fn(),
  });

  app.decorate('jwtTokenService', deps.jwtTokenService ?? {
    verifyAccessToken: vi.fn((token: string) => {
      if (token === 'valid-session-t1') {
        return { sessionId: 'session-1', tenantId: 'tenant-1', userId: 'user-1' };
      }
      throw new UnauthorizedError('Invalid token.');
    }),
  });

  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.ready();
  return app;
}

describe('POST /api/v1/auth/organizations/select', () => {
  let app: Awaited<ReturnType<typeof buildAuthApp>>;

  beforeEach(async () => {
    app = await buildAuthApp();
  });

  it('creates a new organization-scoped session for an authorized user', async () => {
    const tenantResolver = {
      resolveUserMemberships: vi.fn(async () => ({
        organizations: [{
          id: 'org-1',
          tenantId: 'tenant-1',
          code: 'ORG1',
          name: 'Org 1',
          status: 'active',
          isDefault: true,
        }],
        activeOrganizationId: 'org-1',
        requiresOrganizationSelection: false,
      })),
    };

    const authService = {
      validateSession: vi.fn(async (sessionId: string, tenantId: string) => {
        if (sessionId === 'session-1' && tenantId === 'tenant-1') {
          return {
            id: 'user-1',
            tenantId: 'tenant-1',
            organizationId: 'org-1',
            defaultBranchId: null,
            username: 'alice',
            email: 'alice@example.com',
            status: 'active',
          };
        }
        return null;
      }),
      createSessionForUser: vi.fn(async (tenantId: string, userId: string, organizationId: string) => ({
        success: true,
        user: {
          id: userId,
          tenantId,
          organizationId,
          defaultBranchId: null,
          username: 'alice',
          email: 'alice@example.com',
          status: 'active',
        },
        session: {
          id: 'session-2',
          tenantId,
          userId,
          organizationId,
          branchId: null,
          isActive: true,
          expiresAt: new Date(Date.now() + 60_000),
          loginAt: new Date(),
        },
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
      })),
    };

    await app.close();
    app = await buildAuthApp({ tenantResolver, authService });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/organizations/select',
      headers: {
        authorization: 'Bearer valid-session-t1',
        'x-tenant-id': 'tenant-1',
      },
      payload: { organizationId: 'org-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.session.tenantId).toBe('tenant-1');
    expect(body.session.organizationId).toBe('org-1');
    expect(body.accessToken).toBe('access-2');
    expect(body.refreshToken).toBe('refresh-2');
    expect(tenantResolver.resolveUserMemberships).toHaveBeenCalledWith('tenant-1', 'user-1', 'org-1');
    expect(authService.createSessionForUser).toHaveBeenCalledWith('tenant-1', 'user-1', 'org-1');
  });

  it('rejects unauthorized organization selection with 403 and does not create a session', async () => {
    const tenantResolver = {
      resolveUserMemberships: vi.fn(async () => {
        throw new ForbiddenError('Requested organization is not available for this user in the current tenant.');
      }),
    };

    const authService = {
      validateSession: vi.fn(async () => ({
        id: 'user-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        defaultBranchId: null,
        username: 'alice',
        email: 'alice@example.com',
        status: 'active',
      })),
      createSessionForUser: vi.fn(),
    };

    await app.close();
    app = await buildAuthApp({ tenantResolver, authService });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/organizations/select',
      headers: {
        authorization: 'Bearer valid-session-t1',
        'x-tenant-id': 'tenant-1',
      },
      payload: { organizationId: 'org-2' },
    });

    expect(response.statusCode).toBe(403);
    expect(authService.createSessionForUser).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant organization attacks and preserves tenant state', async () => {
    const tenantResolver = {
      resolveUserMemberships: vi.fn(async () => {
        throw new ForbiddenError('Requested organization is not available for this user in the current tenant.');
      }),
    };

    const authService = {
      validateSession: vi.fn(async () => ({
        id: 'user-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        defaultBranchId: null,
        username: 'alice',
        email: 'alice@example.com',
        status: 'active',
      })),
      createSessionForUser: vi.fn(),
    };

    await app.close();
    app = await buildAuthApp({ tenantResolver, authService });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/organizations/select',
      headers: {
        authorization: 'Bearer valid-session-t1',
        'x-tenant-id': 'tenant-1',
      },
      payload: { organizationId: 'org-from-tenant-2' },
    });

    expect(response.statusCode).toBe(403);
    expect((response.json() as { message?: string }).message ?? '').toMatch(/organization|tenant|forbidden/i);
    expect(authService.createSessionForUser).not.toHaveBeenCalled();
  });

  it('rejects client-supplied tenant headers that override the authenticated tenant', async () => {
    const tenantResolver = {
      resolveUserMemberships: vi.fn(),
    };

    const authService = {
      validateSession: vi.fn(async () => ({
        id: 'user-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        defaultBranchId: null,
        username: 'alice',
        email: 'alice@example.com',
        status: 'active',
      })),
      createSessionForUser: vi.fn(),
    };

    await app.close();
    app = await buildAuthApp({ tenantResolver, authService });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/organizations/select',
      headers: {
        authorization: 'Bearer valid-session-t1',
        'x-tenant-id': 'tenant-2',
      },
      payload: { organizationId: 'org-1' },
    });

    expect(response.statusCode).toBe(401);
    expect(authService.createSessionForUser).not.toHaveBeenCalled();
  });

  it('keeps selected organization scoped to the original session context', async () => {
    const tenantResolver = {
      resolveUserMemberships: vi.fn(async (tenantId: string, userId: string, requestedOrganizationId: string) => {
        if (requestedOrganizationId === 'org-2') {
          throw new ForbiddenError('Requested organization is not available for this user in the current tenant.');
        }

        return {
          organizations: [{
            id: 'org-1',
            tenantId,
            code: 'ORG1',
            name: 'Org 1',
            status: 'active',
            isDefault: true,
          }],
          activeOrganizationId: 'org-1',
          requiresOrganizationSelection: false,
        };
      }),
    };

    const authService = {
      validateSession: vi.fn(async () => ({
        id: 'user-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        defaultBranchId: null,
        username: 'alice',
        email: 'alice@example.com',
        status: 'active',
      })),
      createSessionForUser: vi.fn(async () => ({
        success: true,
        user: {
          id: 'user-1',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          defaultBranchId: null,
          username: 'alice',
          email: 'alice@example.com',
          status: 'active',
        },
        session: {
          id: 'session-3',
          tenantId: 'tenant-1',
          userId: 'user-1',
          organizationId: 'org-1',
          branchId: null,
          isActive: true,
          expiresAt: new Date(Date.now() + 60_000),
          loginAt: new Date(),
        },
        accessToken: 'access-3',
        refreshToken: 'refresh-3',
      })),
    };

    await app.close();
    app = await buildAuthApp({ tenantResolver, authService });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/organizations/select',
      headers: {
        authorization: 'Bearer valid-session-t1',
        'x-tenant-id': 'tenant-1',
      },
      payload: { organizationId: 'org-2' },
    });

    expect(response.statusCode).toBe(403);
    expect(authService.createSessionForUser).not.toHaveBeenCalled();
  });
});

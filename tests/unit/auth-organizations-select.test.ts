import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

import authRoutes from '../../src/presentation/http/routes/auth.js';
import { UnauthorizedError } from '../../src/domain/errors.js';

async function buildAuthApp() {
  const app = Fastify({ logger: false });
  app.decorate('appConfig', {
    NODE_ENV: 'test',
    APP_NAME: 'new-erp-final',
    HOST: '127.0.0.1',
    PORT: 3000,
    API_PREFIX: '/api/v1',
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgres://localhost:5432/test',
    DATABASE_POOL_MIN: 1,
    DATABASE_POOL_MAX: 2,
    JWT_SECRET: 'test-jwt-secret-1234567890abcd',
    JWT_ISSUER: 'new-erp-final',
    TENANT_CONTEXT_KEY: 'app.current_tenant_id',
    CORS_ALLOWED_ORIGINS: ['*'],
    isDevelopment: false,
    isTest: true,
    isProduction: false,
  } as any);
  app.decorate('tenantMembershipService', {
    resolveOrganizationMemberships: vi.fn(async () => ({
      organizations: [
        { id: 'org-1', tenantId: 'tenant-1', code: 'ORG1', name: 'Org 1', status: 'active', isDefault: true },
      ],
    })),
  } as any);
  app.decorate('authService', {
    validateSession: vi.fn(async () => ({
      id: 'user-1',
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      defaultBranchId: null,
      username: 'alice',
      email: 'alice@example.com',
      status: 'active',
    })),
  } as any);
  app.decorate('jwtTokenService', {
    config: { JWT_SECRET: 'test-jwt-secret-1234567890abcd', JWT_ISSUER: 'new-erp-final' },
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
  } as any);
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.ready();
  return app;
}

describe('tenant-scoped organization access', () => {
  let app: Awaited<ReturnType<typeof buildAuthApp>>;

  beforeEach(async () => {
    app = await buildAuthApp();
  });

  it('returns organization access without authentication-context fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/organizations',
      headers: { authorization: 'Bearer valid-session-t1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      organizations: [
        { id: 'org-1', tenantId: 'tenant-1', code: 'ORG1', name: 'Org 1', status: 'active', isDefault: true },
      ],
    });
  });

  it('retires organization selection instead of creating a session or tokens', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/organizations/select',
      headers: { authorization: 'Bearer valid-session-t1' },
      payload: { organizationId: 'org-1' },
    });

    expect(response.statusCode).toBe(404);
  });
});

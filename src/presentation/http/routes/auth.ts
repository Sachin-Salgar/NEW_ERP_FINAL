import { FastifyPluginAsync, type FastifyRequest } from 'fastify';

import { ValidationError, UnauthorizedError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const sanitizeUser = (user: { id: string; tenantId: string; organizationId?: string | null; activeLocationId?: string | null; defaultBranchId?: string | null; username: string; email: string; status: string }) => ({
  id: user.id,
  tenantId: user.tenantId,
  organizationId: user.organizationId ?? null,
  activeLocationId: user.activeLocationId ?? null,
  defaultBranchId: user.defaultBranchId ?? null,
  username: user.username,
  email: user.email,
  status: user.status,
});

const getRequestHost = (request: FastifyRequest): string => {
  const hostHeader = request.headers.host;
  if (typeof hostHeader === 'string' && hostHeader.trim()) {
    return hostHeader.trim().split(':')[0].toLowerCase();
  }

  return request.server.appConfig.HOST.toLowerCase();
};

const getTenantIdFromRequest = (request: FastifyRequest): string | null => {
  const config = request.server.appConfig;
  const headerName = config.TENANT_HEADER.toLowerCase();
  const headerValue = request.headers[headerName];
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  const body = request.body as Record<string, unknown> | undefined;
  const bodyTenantId = typeof body?.tenantId === 'string' ? body.tenantId.trim() : null;
  return bodyTenantId || null;
};

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/bootstrap', async (request) => {
    const host = getRequestHost(request);
    const tenant = await request.server.tenantResolver.resolveTenantFromHost(host);

    return {
      success: true,
      deployment: {
        mode: tenant.mode,
        host,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantDisplayName: tenant.displayName ?? tenant.name,
        subdomain: tenant.subdomain,
        slug: tenant.slug,
      },
      branding: {
        name: tenant.name,
        displayName: tenant.displayName ?? tenant.name,
      },
      login: {
        enabled: true,
      },
      capabilities: {
        apiVersion: 'v1',
        multiOrganization: true,
      },
    };
  });

  fastify.post('/auth/register', {
    preHandler: [requireAuth, requirePermission('user.manage')],
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required for registration.');
    }

    const newUser = await request.server.registrationService.registerUser(tenantId, request.user!.id, {
      username: typeof body?.username === 'string' ? body.username : '',
      email: typeof body?.email === 'string' ? body.email : '',
      password: typeof body?.password === 'string' ? body.password : '',
      organizationId: typeof body?.organizationId === 'string' ? body.organizationId : request.user?.organizationId ?? null,
      defaultBranchId: typeof body?.defaultBranchId === 'string' ? body.defaultBranchId : request.user?.defaultBranchId ?? null,
      roleCode: typeof body?.roleCode === 'string' ? body.roleCode : 'member',
    });

    reply.code(201);
    return {
      success: true,
      user: sanitizeUser(newUser),
    };
  });

  fastify.post('/auth/login', async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const headerTenantId = getTenantIdFromRequest(request);
    const tenant = await request.server.tenantResolver.resolveTenantFromHost(getRequestHost(request));
    if (headerTenantId && headerTenantId !== tenant.id) {
      throw new UnauthorizedError('Tenant mismatch detected.');
    }

    if (!identifier || !password) {
      throw new ValidationError('Identifier and password are required.');
    }

    let result = await request.server.authService.authenticate(tenant.id, identifier, password);
    if (!result.success || !result.user || !result.session || !result.accessToken || !result.refreshToken) {
      throw new UnauthorizedError('Invalid credentials.');
    }

    const memberships = await request.server.tenantResolver.resolveUserMemberships(tenant.id, result.user.id);
    if (memberships.requiresOrganizationSelection) {
      await request.server.authService.invalidateSession(result.session.id, tenant.id);
      result = await request.server.authService.createSessionForUser(tenant.id, result.user.id, null);
      if (!result.success || !result.user || !result.session || !result.accessToken || !result.refreshToken) {
        throw new UnauthorizedError('Unable to establish the pre-organization login session.');
      }
    }

    reply.code(200);
    return {
      success: true,
      user: sanitizeUser(result.user),
      session: {
        id: result.session.id,
        tenantId: result.session.tenantId,
        userId: result.session.userId,
        organizationId: result.session.organizationId ?? null,
        locationId: result.session.locationId ?? null,
        branchId: result.session.branchId ?? null,
        isActive: result.session.isActive,
        expiresAt: result.session.expiresAt,
        loginAt: result.session.loginAt,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.session.expiresAt,
      tokenType: 'bearer',
    };
  });

  fastify.post('/auth/refresh', async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : '';
    if (!refreshToken) {
      throw new ValidationError('Refresh token is required.');
    }

    const claims = request.server.jwtTokenService.verifyRefreshToken(refreshToken);
    const sessionHash = request.server.jwtTokenService.hashTokenValue(refreshToken);
    const session = await request.server.authService.findSessionByRefreshTokenHash(claims.tenantId, sessionHash);
    if (!session || !session.isActive || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('Session is invalid or expired.');
    }

    const user = await request.server.authService.validateSession(claims.sessionId, claims.tenantId);
    if (!user) {
      throw new UnauthorizedError('Session is invalid or expired.');
    }

    const accessToken = request.server.jwtTokenService.createAccessToken({
      userId: user.id,
      tenantId: claims.tenantId,
      sessionId: claims.sessionId,
      expiresInSeconds: 60 * 60,
    });

    reply.code(200);
    return {
      success: true,
      accessToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      tokenType: 'bearer',
      user: sanitizeUser(user),
    };
  });

  fastify.get('/auth/me', { preHandler: requireAuth }, async (request) => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required.');
    }

    return {
      success: true,
      user: sanitizeUser(request.user),
    };
  });

  fastify.get('/auth/organizations', { preHandler: requireAuth }, async (request) => {
    if (!request.user || !request.tenantId) {
      throw new UnauthorizedError('Authentication required.');
    }

    const memberships = await request.server.tenantResolver.resolveUserMemberships(request.tenantId, request.user.id);
    return {
      success: true,
      organizations: memberships.organizations,
      activeOrganizationId: memberships.activeOrganizationId,
      requiresOrganizationSelection: memberships.requiresOrganizationSelection,
    };
  });

  fastify.post('/auth/organizations/select', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user || !request.tenantId) {
      throw new UnauthorizedError('Authentication required.');
    }

    const body = request.body as Record<string, unknown> | undefined;
    const requestedOrg = typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';
    if (!requestedOrg) {
      return reply.code(400).send({ success: false, message: 'organizationId is required' });
    }

    await request.server.tenantResolver.resolveUserMemberships(request.tenantId, request.user.id, requestedOrg);

    const result = await request.server.authService.createSessionForUser(request.tenantId, request.user.id, requestedOrg);
    if (!result.success || !result.user || !result.session) {
      throw new UnauthorizedError('Failed to create organization session.');
    }

    reply.code(200);
    return {
      success: true,
      user: sanitizeUser(result.user),
      session: {
        id: result.session.id,
        tenantId: result.session.tenantId,
        userId: result.session.userId,
        organizationId: result.session.organizationId ?? null,
        locationId: result.session.locationId ?? null,
        branchId: result.session.branchId ?? null,
        isActive: result.session.isActive,
        expiresAt: result.session.expiresAt,
        loginAt: result.session.loginAt,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.session.expiresAt,
      tokenType: 'bearer',
    };
  });

  fastify.get('/auth/modules', { preHandler: requireAuth }, async (request) => {
    if (!request.user || !request.tenantId) {
      throw new UnauthorizedError('Authentication required.');
    }
    if (!request.user.organizationId) {
      throw new ValidationError('An active organization is required.');
    }

    const modules = await request.server.moduleAccessService.listAccessibleModules(
      request.tenantId,
      request.user.organizationId,
    );

    return {
      success: true,
      organizationId: request.user.organizationId,
      modules,
    };
  });

  fastify.post('/auth/modules/:code/enable', {
    preHandler: [requireAuth, requirePermission('tenant.manage')],
  }, async (request) => {
    if (!request.user || !request.tenantId || !request.user.organizationId) {
      throw new UnauthorizedError('Authentication and organization context are required.');
    }

    const moduleCode = ((request.params as { code?: string }).code ?? '').trim();
    const module = await request.server.moduleAccessService.setOrganizationModule(
      request.tenantId,
      request.user.organizationId,
      moduleCode,
      true,
      request.user.id,
    );

    return { success: true, enabled: true, module };
  });

  fastify.post('/auth/modules/:code/disable', {
    preHandler: [requireAuth, requirePermission('tenant.manage')],
  }, async (request) => {
    if (!request.user || !request.tenantId || !request.user.organizationId) {
      throw new UnauthorizedError('Authentication and organization context are required.');
    }

    const moduleCode = ((request.params as { code?: string }).code ?? '').trim();
    await request.server.moduleAccessService.setOrganizationModule(
      request.tenantId,
      request.user.organizationId,
      moduleCode,
      false,
      request.user.id,
    );

    return { success: true, enabled: false, moduleCode };
  });

  fastify.post('/auth/logout', { preHandler: requireAuth }, async (request) => {
    if (!request.user || !request.sessionId || !request.tenantId) {
      throw new UnauthorizedError('Authentication required.');
    }

    await request.server.authService.invalidateSession(request.sessionId, request.tenantId);
    return {
      success: true,
      message: 'Session invalidated.',
    };
  });

  fastify.get('/auth/protected', { preHandler: requireAuth }, async (request) => ({
    success: true,
    user: sanitizeUser(request.user!),
    tenantId: request.tenantId,
    sessionId: request.sessionId,
  }));
};
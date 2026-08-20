import { FastifyPluginAsync, type FastifyRequest } from 'fastify';

import { ValidationError, UnauthorizedError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const sanitizeUser = (user: { id: string; tenantId: string; organizationId?: string | null; defaultBranchId?: string | null; username: string; email: string; status: string }) => ({
  id: user.id,
  tenantId: user.tenantId,
  organizationId: user.organizationId ?? null,
  defaultBranchId: user.defaultBranchId ?? null,
  username: user.username,
  email: user.email,
  status: user.status,
});

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
    const tenantId = getTenantIdFromRequest(request);

    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    if (!identifier || !password) {
      throw new ValidationError('Identifier and password are required.');
    }

    const result = await request.server.authService.authenticate(tenantId, identifier, password);
    if (!result.success || !result.user || !result.session || !result.accessToken || !result.refreshToken) {
      throw new UnauthorizedError('Invalid credentials.');
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

export default authRoutes;

import { FastifyPluginAsync } from 'fastify';

import { ValidationError, UnauthorizedError, ForbiddenError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const sanitizeUser = (user: { id: string; tenantId: string; organizationId?: string | null; activeLocationId?: string | null; defaultLocationId?: string | null; defaultBranchId?: string | null; username: string; email: string; status: string }) => ({
  id: user.id,
  tenantId: user.tenantId,
  organizationId: user.organizationId ?? null,
  activeLocationId: user.activeLocationId ?? null,
  defaultLocationId: user.defaultLocationId ?? null,
  defaultBranchId: user.defaultBranchId ?? null,
  username: user.username,
  email: user.email,
  status: user.status,
});

const sanitizeSession = (session: { id: string; tenantId: string; userId: string; organizationId?: string | null; locationId?: string | null; branchId?: string | null; isActive: boolean; expiresAt: Date; loginAt: Date }) => ({
  id: session.id,
  tenantId: session.tenantId,
  userId: session.userId,
  organizationId: session.organizationId ?? null,
  locationId: session.locationId ?? null,
  branchId: session.branchId ?? null,
  isActive: session.isActive,
  expiresAt: session.expiresAt,
  loginAt: session.loginAt,
});

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Bootstrap describes the deployment only. It never selects or resolves a tenant.
  fastify.get('/bootstrap', async (request) => ({
    success: true,
    deployment: { apiVersion: 'v1', environment: request.server.appConfig.NODE_ENV },
    login: { enabled: true },
    capabilities: { apiVersion: 'v1', tenantSelection: false, multiOrganization: true, workingContextSelection: true },
  }));

  fastify.post('/auth/register', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const tenantId = request.tenantId;
    if (!tenantId) throw new ValidationError('Tenant context is required for registration.');
    const newUser = await request.server.registrationService.registerUser(tenantId, request.user!.id, {
      username: typeof body?.username === 'string' ? body.username : '',
      email: typeof body?.email === 'string' ? body.email : '',
      password: typeof body?.password === 'string' ? body.password : '',
      organizationId: typeof body?.organizationId === 'string' ? body.organizationId : request.user?.organizationId ?? null,
      defaultBranchId: typeof body?.defaultBranchId === 'string' ? body.defaultBranchId : request.user?.defaultBranchId ?? null,
      defaultLocationId: typeof body?.defaultLocationId === 'string' ? body.defaultLocationId : request.user?.defaultLocationId ?? null,
      roleCode: typeof body?.roleCode === 'string' ? body.roleCode : 'member',
    });
    reply.code(201);
    return { success: true, user: sanitizeUser(newUser) };
  });

  fastify.post('/auth/login', async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!identifier || !password) throw new ValidationError('Identifier and password are required.');

    const result = await request.server.authService.authenticate(identifier, password);
    if (!result.success || !result.user || !result.session || !result.accessToken || !result.refreshToken) throw new UnauthorizedError('Invalid credentials.');

    // Authentication establishes tenant authority. Organization is resolved from the user's membership/default.
    const memberships = await request.server.tenantMembershipService.resolveOrganizationMemberships(result.user.tenantId, result.user.id);
    let finalResult = result;
    if (memberships.activeOrganizationId && !result.user.organizationId) {
      await request.server.authService.invalidateSession(result.session.id, result.user.tenantId);
      finalResult = await request.server.authService.createSessionForUser(result.user.tenantId, result.user.id, memberships.activeOrganizationId);
      if (!finalResult.success || !finalResult.user || !finalResult.session || !finalResult.accessToken || !finalResult.refreshToken) throw new UnauthorizedError('Unable to establish the tenant-scoped login session.');
    }

    reply.code(200);
    return {
      success: true,
      user: sanitizeUser(finalResult.user!),
      session: sanitizeSession(finalResult.session!),
      accessToken: finalResult.accessToken,
      refreshToken: finalResult.refreshToken,
      expiresAt: finalResult.session!.expiresAt,
      tokenType: 'bearer',
      tenant: { id: finalResult.user!.tenantId },
      organizations: memberships.organizations,
      activeOrganizationId: memberships.activeOrganizationId,
      requiresOrganizationSelection: false,
    };
  });

  fastify.post('/auth/refresh', async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : '';
    if (!refreshToken) throw new ValidationError('Refresh token is required.');
    const claims = request.server.jwtTokenService.verifyRefreshToken(refreshToken);
    const sessionHash = request.server.jwtTokenService.hashTokenValue(refreshToken);
    const session = await request.server.authService.findSessionByRefreshTokenHash(claims.tenantId, sessionHash);
    if (!session || !session.isActive || session.expiresAt.getTime() <= Date.now()) throw new UnauthorizedError('Session is invalid or expired.');
    const user = await request.server.authService.validateSession(claims.sessionId, claims.tenantId);
    if (!user) throw new UnauthorizedError('Session is invalid or expired.');
    const accessToken = request.server.jwtTokenService.createAccessToken({ userId: user.id, tenantId: claims.tenantId, sessionId: claims.sessionId, expiresInSeconds: 60 * 60 });
    reply.code(200);
    return { success: true, accessToken, expiresAt: new Date(Date.now() + 1000 * 60 * 60), tokenType: 'bearer', user: sanitizeUser(user) };
  });

  fastify.get('/auth/me', { preHandler: requireAuth }, async (request) => {
    if (!request.user) throw new UnauthorizedError('Authentication required.');
    return { success: true, user: sanitizeUser(request.user) };
  });

  fastify.get('/auth/organizations', { preHandler: requireAuth }, async (request) => {
    if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
    const memberships = await request.server.tenantMembershipService.resolveOrganizationMemberships(request.tenantId, request.user.id);
    return { success: true, organizations: memberships.organizations, activeOrganizationId: memberships.activeOrganizationId, requiresOrganizationSelection: false };
  });

  fastify.post('/auth/organizations/select', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
    const body = request.body as Record<string, unknown> | undefined;
    const requestedOrg = typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';
    if (!requestedOrg) return reply.code(400).send({ success: false, message: 'organizationId is required' });
    await request.server.tenantMembershipService.resolveOrganizationMemberships(request.tenantId, request.user.id, requestedOrg);
    const result = await request.server.authService.createSessionForUser(request.tenantId, request.user.id, requestedOrg);
    if (!result.success || !result.user || !result.session) throw new UnauthorizedError('Failed to create organization session.');
    reply.code(200);
    return { success: true, user: sanitizeUser(result.user), session: sanitizeSession(result.session), accessToken: result.accessToken, refreshToken: result.refreshToken, expiresAt: result.session.expiresAt, tokenType: 'bearer' };
  });

  fastify.post('/auth/context/select', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
    const body = request.body as Record<string, unknown> | undefined;
    const organizationId = typeof body?.organizationId === 'string' ? body.organizationId.trim() : request.user.organizationId ?? '';
    const branchId = typeof body?.branchId === 'string' ? body.branchId.trim() : request.user.defaultBranchId ?? '';
    const locationId = typeof body?.locationId === 'string' ? body.locationId.trim() : request.user.activeLocationId ?? request.user.defaultLocationId ?? '';

    if (!organizationId) return reply.code(400).send({ success: false, message: 'organizationId is required' });
    if (!branchId) return reply.code(400).send({ success: false, message: 'branchId is required' });
    if (!locationId) return reply.code(400).send({ success: false, message: 'locationId is required' });

    await request.server.tenantMembershipService.resolveOrganizationMemberships(request.tenantId, request.user.id, organizationId);
    const branch = await request.server.branchService.getAccessibleBranchByIdForUser(request.tenantId, request.user.id, branchId, organizationId);
    if (!branch) throw new ForbiddenError('Branch is not available for the selected organization.');
    const location = await request.server.locationService.getAccessibleLocationByIdForUser(request.tenantId, request.user.id, locationId, organizationId);
    if (!location) throw new ForbiddenError('Location is not available for the selected organization.');

    const result = await request.server.authService.createSessionForUser(request.tenantId, request.user.id, organizationId, location.id, branch.id);
    if (!result.success || !result.user || !result.session) throw new UnauthorizedError('Failed to establish the selected working context.');

    reply.code(200);
    return {
      success: true,
      user: sanitizeUser(result.user),
      session: sanitizeSession(result.session),
      branch,
      location,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.session.expiresAt,
      tokenType: 'bearer',
    };
  });

  fastify.get('/auth/modules', { preHandler: requireAuth }, async (request) => {
    if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
    if (!request.user.organizationId) throw new ValidationError('An active organization is required.');
    const modules = await request.server.moduleAccessService.listAccessibleModules(request.tenantId, request.user.organizationId);
    return { success: true, organizationId: request.user.organizationId, modules };
  });

  fastify.post('/auth/modules/:code/enable', { preHandler: [requireAuth, requirePermission('tenant.manage')] }, async (request) => {
    if (!request.user || !request.tenantId || !request.user.organizationId) throw new UnauthorizedError('Authentication and organization context are required.');
    const moduleCode = ((request.params as { code?: string }).code ?? '').trim();
    const module = await request.server.moduleAccessService.setOrganizationModule(request.tenantId, request.user.organizationId, moduleCode, true, request.user.id);
    return { success: true, enabled: true, module };
  });

  fastify.post('/auth/modules/:code/disable', { preHandler: [requireAuth, requirePermission('tenant.manage')] }, async (request) => {
    if (!request.user || !request.tenantId || !request.user.organizationId) throw new UnauthorizedError('Authentication and organization context are required.');
    const moduleCode = ((request.params as { code?: string }).code ?? '').trim();
    await request.server.moduleAccessService.setOrganizationModule(request.tenantId, request.user.organizationId, moduleCode, false, request.user.id);
    return { success: true, enabled: false, moduleCode };
  });

  fastify.post('/auth/logout', { preHandler: requireAuth }, async (request) => {
    if (!request.user || !request.sessionId || !request.tenantId) throw new UnauthorizedError('Authentication required.');
    await request.server.authService.invalidateSession(request.sessionId, request.tenantId);
    return { success: true, message: 'Session invalidated.' };
  });

  fastify.get('/auth/protected', { preHandler: requireAuth }, async (request) => ({ success: true, user: sanitizeUser(request.user!), tenantId: request.tenantId, sessionId: request.sessionId }));
};

export default authRoutes;

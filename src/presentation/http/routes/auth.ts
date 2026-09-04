import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ValidationError, UnauthorizedError, ForbiddenError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { requestParam } from '../request-input.js';
import {
  authSchemas,
  errorResponseSchema,
  toJsonSchema,
} from '../swagger.js';

// JSON Schema versions for routes that have zod-to-json-schema conversion issues
const registerRequestJsonSchema = {
  type: 'object',
  required: ['username', 'email', 'password'],
  properties: {
    username: { type: 'string', minLength: 3, maxLength: 150 },
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8, maxLength: 128 },
    organizationId: { type: 'string', format: 'uuid' },
    defaultBranchId: { type: 'string', format: 'uuid' },
    defaultLocationId: { type: 'string', format: 'uuid' },
    roleCode: { type: 'string', minLength: 1, maxLength: 50 },
  },
};

const loginRequestJsonSchema = {
  type: 'object',
  required: ['identifier', 'password'],
  properties: {
    identifier: { type: 'string', minLength: 1, description: 'Username or email' },
    password: { type: 'string', minLength: 1, description: 'Password' },
  },
};

const loginResponseJsonSchema = {
  type: 'object',
  required: ['success', 'user', 'session', 'accessToken', 'refreshToken', 'expiresAt', 'tokenType', 'tenant', 'organizations', 'activeOrganizationId', 'requiresOrganizationSelection'],
  properties: {
    success: { type: 'boolean', const: true },
    user: {
      type: 'object',
      required: ['id', 'tenantId', 'organizationId', 'activeLocationId', 'defaultLocationId', 'defaultBranchId', 'username', 'email', 'status'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        tenantId: { type: 'string', format: 'uuid' },
        organizationId: { type: ['string', 'null'], format: 'uuid' },
        activeLocationId: { type: ['string', 'null'], format: 'uuid' },
        defaultLocationId: { type: ['string', 'null'], format: 'uuid' },
        defaultBranchId: { type: ['string', 'null'], format: 'uuid' },
        username: { type: 'string' },
        email: { type: 'string', format: 'email' },
        status: { type: 'string' },
      },
    },
    session: {
      type: 'object',
      required: ['id', 'tenantId', 'userId', 'organizationId', 'locationId', 'branchId', 'isActive', 'expiresAt', 'loginAt'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        tenantId: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        organizationId: { type: ['string', 'null'], format: 'uuid' },
        locationId: { type: ['string', 'null'], format: 'uuid' },
        branchId: { type: ['string', 'null'], format: 'uuid' },
        isActive: { type: 'boolean' },
        expiresAt: { type: 'string', format: 'date-time' },
        loginAt: { type: 'string', format: 'date-time' },
      },
    },
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    expiresAt: { type: 'string', format: 'date-time' },
    tokenType: { type: 'string', const: 'bearer' },
    tenant: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } },
    },
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'tenantId', 'code', 'name', 'status', 'isDefault'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          code: { type: 'string' },
          name: { type: 'string' },
          status: { type: 'string' },
          isDefault: { type: 'boolean' },
        },
      },
    },
    activeOrganizationId: { type: ['string', 'null'], format: 'uuid' },
    requiresOrganizationSelection: { type: 'boolean' },
  },
};

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

const authRateLimit = (fastify: Parameters<FastifyPluginAsync>[0], max: number) => ({
  max: fastify.appConfig.isTest ? Math.max(max, 1000) : max,
  timeWindow: fastify.appConfig.AUTH_RATE_LIMIT_WINDOW_MS,
});

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/bootstrap', {
    schema: {
      tags: ['Bootstrap'],
      summary: 'Get deployment bootstrap information',
      description: 'Returns deployment metadata and API capabilities. No authentication required.',
      // Response schema omitted to avoid fastify-swagger serialization issue
      // The schema is documented in components for Swagger UI
    },
  }, async (request) => ({
    success: true,
    deployment: { apiVersion: 'v1', environment: request.server.appConfig.NODE_ENV },
    login: { enabled: true },
    capabilities: { apiVersion: 'v1', tenantSelection: false, multiOrganization: true, workingContextSelection: true },
  }));

fastify.post('/auth/register', {
    schema: {
      tags: ['Authentication'],
      summary: 'Register a new user',
      description: 'Register a new user within the current tenant. Requires user.manage permission.',
      security: [{ bearerAuth: [] }],
      body: registerRequestJsonSchema,
      // Response schema omitted to avoid fastify-swagger serialization issue
      // The schema is documented in components for Swagger UI
    },
  bodyLimit: 10 * 1024,
  config: { rateLimit: authRateLimit(fastify, fastify.appConfig.AUTH_REGISTER_RATE_LIMIT) },
  preHandler: [requireAuth, requirePermission('user.manage')],
}, async (request, reply) => {
    const body = authSchemas.registerRequest.parse(request.body);
    const tenantId = request.tenantId;
    if (!tenantId) throw new ValidationError('Tenant context is required for registration.');
    const newUser = await request.server.registrationService.registerUser(tenantId, request.user!.id, {
      username: body.username,
      email: body.email,
      password: body.password,
      organizationId: body.organizationId ?? request.user?.organizationId ?? null,
      defaultBranchId: body.defaultBranchId ?? request.user?.defaultBranchId ?? null,
      defaultLocationId: body.defaultLocationId ?? request.user?.defaultLocationId ?? null,
      roleCode: body.roleCode ?? 'member',
    });
    reply.code(201);
    return { success: true, user: sanitizeUser(newUser) };
  });

  fastify.post('/auth/login', {
    schema: {
      tags: ['Authentication'],
      summary: 'Authenticate user and create session',
      description: 'Authenticate with username/email and password. Returns access token, refresh token, and user context. Tenant is resolved from Host header or x-tenant-id header.',
      body: loginRequestJsonSchema,
      // Response schema omitted to avoid fastify-swagger serialization issue
      // The schema is documented in components for Swagger UI
    },
    bodyLimit: 10 * 1024,
    config: { rateLimit: authRateLimit(fastify, fastify.appConfig.AUTH_LOGIN_RATE_LIMIT) },
  }, async (request, reply) => {
    const body = authSchemas.loginRequest.parse(request.body);
    const identifier = body.identifier.trim();
    const password = body.password;

    const result = await request.server.authService.authenticate(identifier, password);
    if (!result.success || !result.user || !result.session || !result.accessToken || !result.refreshToken) throw new UnauthorizedError('Invalid credentials.');

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

  fastify.post('/auth/refresh', {
    schema: {
      tags: ['Authentication'],
      summary: 'Refresh access token',
      description: 'Exchange a valid refresh token for a new access token.',
      body: toJsonSchema(authSchemas.refreshRequest),
      response: {
      200: toJsonSchema(authSchemas.refreshResponse),
      400: toJsonSchema(errorResponseSchema),
      401: toJsonSchema(errorResponseSchema),
      },
    },
    bodyLimit: 10 * 1024,
    config: { rateLimit: authRateLimit(fastify, fastify.appConfig.AUTH_REFRESH_RATE_LIMIT) },
  }, async (request, reply) => {
    const body = authSchemas.refreshRequest.parse(request.body);
    const refreshToken = body.refreshToken;
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

  fastify.get('/auth/me', {
    schema: {
      tags: ['Authentication'],
      summary: 'Get current authenticated user',
      description: 'Returns the current authenticated user information.',
      security: [{ bearerAuth: [] }],
      response: {
        200: toJsonSchema(authSchemas.meResponse),
        401: toJsonSchema(errorResponseSchema),
      },
    },
    preHandler: requireAuth,
  }, async (request) => {
    if (!request.user) throw new UnauthorizedError('Authentication required.');
    return { success: true, user: sanitizeUser(request.user) };
  });

  fastify.get('/auth/organizations', {
    schema: {
      tags: ['Authentication'],
      summary: 'List user organization memberships',
      description: 'Returns all organizations the user has access to and the active organization.',
      security: [{ bearerAuth: [] }],
      response: {
        200: toJsonSchema(z.object({
          success: z.boolean().describe('Always true'),
          organizations: z.array(z.object({
            id: z.string().uuid(),
            tenantId: z.string().uuid(),
            code: z.string(),
            name: z.string(),
            status: z.string(),
            isDefault: z.boolean(),
          })),
          activeOrganizationId: z.string().uuid().nullable(),
          requiresOrganizationSelection: z.boolean(),
        })),
        401: toJsonSchema(errorResponseSchema),
      },
    },
    preHandler: requireAuth,
  }, async (request) => {
    if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
    const memberships = await request.server.tenantMembershipService.resolveOrganizationMemberships(request.tenantId, request.user.id);
    return { success: true, organizations: memberships.organizations, activeOrganizationId: memberships.activeOrganizationId, requiresOrganizationSelection: false };
  });

  fastify.post('/auth/organizations/select', {
    schema: {
      tags: ['Authentication'],
      summary: 'Select active organization',
      description: 'Switch the active organization for the current session. Creates a new session with the selected organization context.',
      security: [{ bearerAuth: [] }],
      body: toJsonSchema(authSchemas.orgSelectRequest),
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
    const body = authSchemas.orgSelectRequest.parse(request.body);
    const requestedOrg = body.organizationId.trim();
    await request.server.tenantMembershipService.resolveOrganizationMemberships(request.tenantId, request.user.id, requestedOrg);
    const result = await request.server.authService.createSessionForUser(request.tenantId, request.user.id, requestedOrg);
    if (!result.success || !result.user || !result.session) throw new UnauthorizedError('Failed to create organization session.');
    reply.code(200);
    return { success: true, user: sanitizeUser(result.user), session: sanitizeSession(result.session), accessToken: result.accessToken, refreshToken: result.refreshToken, expiresAt: result.session.expiresAt, tokenType: 'bearer' };
  });

  fastify.post('/auth/context/select', {
    schema: {
      tags: ['Authentication'],
      summary: 'Select working context (organization, branch, location)',
      description: 'Establish a complete working context including organization, branch, and location. Creates a new session with the selected context.',
      security: [{ bearerAuth: [] }],
      body: toJsonSchema(authSchemas.contextSelectRequest),
      response: {
      200: toJsonSchema(authSchemas.contextSelectResponse),
      400: toJsonSchema(errorResponseSchema),
      401: toJsonSchema(errorResponseSchema),
      403: toJsonSchema(errorResponseSchema),
      },
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
    const body = authSchemas.contextSelectRequest.parse(request.body);
    const organizationId = body.organizationId.trim();
    const branchId = body.branchId.trim();
    const locationId = body.locationId.trim();

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

  fastify.get('/auth/modules', {
    schema: {
      tags: ['Authentication'],
      summary: 'List accessible modules for current organization',
      description: 'Returns all modules enabled for the current organization.',
      security: [{ bearerAuth: [] }],
      response: {
        200: toJsonSchema(authSchemas.modulesResponse),
        400: toJsonSchema(errorResponseSchema),
        401: toJsonSchema(errorResponseSchema),
      },
    },
    preHandler: requireAuth,
  }, async (request) => {
    if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
    if (!request.user.organizationId) throw new ValidationError('An active organization is required.');
    const modules = await request.server.moduleAccessService.listAccessibleModules(request.tenantId, request.user.organizationId);
    return { success: true, organizationId: request.user.organizationId, modules };
  });

  fastify.post('/auth/modules/:code/enable', {
    schema: {
      tags: ['Authentication'],
      summary: 'Enable a module for the organization',
      description: 'Enable a module for the current organization. Requires tenant.manage permission.',
      security: [{ bearerAuth: [] }],
      params: toJsonSchema(z.object({ code: z.string().min(1) })),
      response: {
      200: toJsonSchema(authSchemas.moduleToggleResponse),
      400: toJsonSchema(errorResponseSchema),
      401: toJsonSchema(errorResponseSchema),
      403: toJsonSchema(errorResponseSchema),
      },
    },
    preHandler: [requireAuth, requirePermission('tenant.manage')],
  }, async (request) => {
    if (!request.user || !request.tenantId || !request.user.organizationId) throw new UnauthorizedError('Authentication and organization context are required.');
    const moduleCode = (requestParam(request.params, 'code') ?? '').trim();
    const module = await request.server.moduleAccessService.setOrganizationModule(request.tenantId, request.user.organizationId, moduleCode, true, request.user.id);
    return { success: true, enabled: true, module };
  });

  fastify.post('/auth/modules/:code/disable', {
    schema: {
      tags: ['Authentication'],
      summary: 'Disable a module for the organization',
      description: 'Disable a module for the current organization. Requires tenant.manage permission.',
      security: [{ bearerAuth: [] }],
      params: toJsonSchema(z.object({ code: z.string().min(1) })),
      response: {
      200: toJsonSchema(authSchemas.moduleToggleResponse),
      400: toJsonSchema(errorResponseSchema),
      401: toJsonSchema(errorResponseSchema),
      403: toJsonSchema(errorResponseSchema),
      },
    },
    preHandler: [requireAuth, requirePermission('tenant.manage')],
  }, async (request) => {
    if (!request.user || !request.tenantId || !request.user.organizationId) throw new UnauthorizedError('Authentication and organization context are required.');
    const moduleCode = (requestParam(request.params, 'code') ?? '').trim();
    await request.server.moduleAccessService.setOrganizationModule(request.tenantId, request.user.organizationId, moduleCode, false, request.user.id);
    return { success: true, enabled: false, moduleCode };
  });

  fastify.post('/auth/logout', {
    schema: {
      tags: ['Authentication'],
      summary: 'Logout and invalidate session',
      description: 'Invalidate the current session and revoke the refresh token.',
      security: [{ bearerAuth: [] }],
      response: {
        200: toJsonSchema(authSchemas.logoutResponse),
        401: toJsonSchema(errorResponseSchema),
      },
    },
    preHandler: requireAuth,
  }, async (request) => {
    if (!request.user || !request.sessionId || !request.tenantId) throw new UnauthorizedError('Authentication required.');
    await request.server.authService.invalidateSession(request.sessionId, request.tenantId);
    return { success: true, message: 'Session invalidated.' };
  });

  fastify.get('/auth/protected', {
    schema: {
      tags: ['Authentication'],
      summary: 'Protected endpoint for testing authentication',
      description: 'Returns user info if authenticated. Used for testing.',
      security: [{ bearerAuth: [] }],
      response: {
        200: toJsonSchema(z.object({
          success: z.boolean().describe('Always true'),
          user: z.object({
            id: z.string().uuid(),
            tenantId: z.string().uuid(),
            organizationId: z.string().uuid().nullable(),
            activeLocationId: z.string().uuid().nullable(),
            defaultLocationId: z.string().uuid().nullable(),
            defaultBranchId: z.string().uuid().nullable(),
            username: z.string(),
            email: z.string().email(),
            status: z.string(),
          }),
          tenantId: z.string().uuid(),
          sessionId: z.string().uuid(),
        })),
        401: toJsonSchema(errorResponseSchema),
      },
    },
    preHandler: requireAuth,
  }, async (request) => ({ success: true, user: sanitizeUser(request.user!), tenantId: request.tenantId, sessionId: request.sessionId }));
};

export default authRoutes;
import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ValidationError, UnauthorizedError, ForbiddenError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { authSchemas, errorResponseSchema, toJsonSchema } from '../swagger.js';
import { recordSecurityEvent } from '../security-audit.js';

interface ModuleCodeParams {
  code: string;
}

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
} as const;

const loginRequestJsonSchema = {
  type: 'object',
  required: ['identifier', 'password'],
  properties: {
    identifier: { type: 'string', minLength: 1, description: 'Username or email' },
    password: { type: 'string', minLength: 1, description: 'Password' },
  },
} as const;

const sanitizeUser = (user: {
  id: string;
  tenantId: string;
  organizationId?: string | null;
  activeLocationId?: string | null;
  defaultLocationId?: string | null;
  defaultBranchId?: string | null;
  username: string;
  email: string;
  status: string;
}) => ({
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

const sanitizeSession = (session: {
  id: string;
  tenantId: string;
  userId: string;
  organizationId?: string | null;
  locationId?: string | null;
  branchId?: string | null;
  financialYearId?: string | null;
  isActive: boolean;
  expiresAt: Date;
  loginAt: Date;
}) => ({
  id: session.id,
  tenantId: session.tenantId,
  userId: session.userId,
  organizationId: session.organizationId ?? null,
  locationId: session.locationId ?? null,
  branchId: session.branchId ?? null,
  financialYearId: session.financialYearId ?? null,
  isActive: session.isActive,
  expiresAt: session.expiresAt,
  loginAt: session.loginAt,
});

const authRateLimit = (fastify: Parameters<FastifyPluginAsync>[0], max: number) => ({
  max: fastify.appConfig.isTest ? Math.max(max, 1000) : max,
  timeWindow: fastify.appConfig.AUTH_RATE_LIMIT_WINDOW_MS,
});

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/bootstrap',
    {
      schema: {
        tags: ['Bootstrap'],
        summary: 'Get deployment bootstrap information',
        description: 'Returns deployment metadata and API capabilities. No authentication required.',
      },
    },
    async (request) => ({
      success: true,
      deployment: { apiVersion: 'v1', environment: request.server.appConfig.NODE_ENV },
      login: { enabled: true },
      capabilities: {
        apiVersion: 'v1',
        tenantSelection: false,
        multiOrganization: true,
        workingContextSelection: true,
      },
    }),
  );

  fastify.post<{ Body: z.infer<typeof authSchemas.registerRequest> }>(
    '/auth/register',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        description: 'Register a new user within the current tenant. Requires user.manage permission.',
        security: [{ bearerAuth: [] }],
        body: registerRequestJsonSchema,
      },
      bodyLimit: 10 * 1024,
      config: { rateLimit: authRateLimit(fastify, fastify.appConfig.AUTH_REGISTER_RATE_LIMIT) },
      preHandler: [requireAuth, requirePermission('user.manage')],
    },
    async (request, reply) => {
      const body = authSchemas.registerRequest.parse(request.body);
      const tenantId = request.tenantId;
      if (!tenantId || !request.user) throw new ValidationError('Tenant context is required for registration.');
      const newUser = await request.server.registrationService.registerUser(tenantId, request.user.id, {
        username: body.username,
        email: body.email,
        password: body.password,
        organizationId: body.organizationId ?? request.user.organizationId ?? null,
        defaultBranchId: body.defaultBranchId ?? request.user.defaultBranchId ?? null,
        defaultLocationId: body.defaultLocationId ?? request.user.defaultLocationId ?? null,
        roleCode: body.roleCode ?? 'member',
      });
      reply.code(201);
      return { success: true, user: sanitizeUser(newUser) };
    },
  );

  fastify.post<{ Body: z.infer<typeof authSchemas.loginRequest> }>(
    '/auth/login',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Authenticate user and create session',
        description:
          'Authenticate with username/email and password. Returns access token, refresh token, and user context.',
        body: loginRequestJsonSchema,
      },
      bodyLimit: 10 * 1024,
      config: { rateLimit: authRateLimit(fastify, fastify.appConfig.AUTH_LOGIN_RATE_LIMIT) },
    },
    async (request, reply) => {
      const body = authSchemas.loginRequest.parse(request.body);
      const result = await request.server.authService.authenticate(body.identifier.trim(), body.password);
      if (!result.success || !result.user || !result.session || !result.accessToken || !result.refreshToken) {
        if (result.failureTenantId) {
          await recordSecurityEvent(request, {
            tenantId: result.failureTenantId,
            actorUserId: result.failureUserId ?? null,
            action: result.reason === 'ACCOUNT_LOCKED' ? 'auth.account.lockout' : 'auth.login.failure',
            resourceType: 'authentication',
            resourceId: result.failureUserId ?? null,
            outcome: 'failure',
            metadata: {
              reason: result.reason ?? 'INVALID_CREDENTIALS',
              retryAfterSeconds: result.retryAfterSeconds ?? null,
            },
          });
        }
        throw new UnauthorizedError('Invalid credentials.');
      }
      await recordSecurityEvent(request, {
        tenantId: result.user.tenantId,
        actorUserId: result.user.id,
        action: 'auth.login.success',
        resourceType: 'session',
        resourceId: result.session.id,
        outcome: 'success',
        metadata: { sessionId: result.session.id },
      });

      const memberships = await request.server.tenantMembershipService.resolveOrganizationMemberships(
        result.user.tenantId,
        result.user.id,
      );
      let finalResult = result;
      if (memberships.activeOrganizationId && !result.user.organizationId) {
        await request.server.authService.invalidateSession(result.session.id, result.user.tenantId);
        finalResult = await request.server.authService.createSessionForUser(
          result.user.tenantId,
          result.user.id,
          memberships.activeOrganizationId,
        );
        if (
          !finalResult.success ||
          !finalResult.user ||
          !finalResult.session ||
          !finalResult.accessToken ||
          !finalResult.refreshToken
        ) {
          throw new UnauthorizedError('Unable to establish the tenant-scoped login session.');
        }
      }

      const finalUser = finalResult.user;
      const finalSession = finalResult.session;
      if (!finalUser || !finalSession) throw new UnauthorizedError('Unable to establish login session.');

      reply.code(200);
      return {
        success: true,
        user: sanitizeUser(finalUser),
        session: sanitizeSession(finalSession),
        accessToken: finalResult.accessToken,
        refreshToken: finalResult.refreshToken,
        expiresAt: finalSession.expiresAt,
        tokenType: 'bearer',
        tenant: { id: finalUser.tenantId },
        organizations: memberships.organizations,
        activeOrganizationId: memberships.activeOrganizationId,
        requiresOrganizationSelection: false,
      };
    },
  );

  fastify.post<{ Body: z.infer<typeof authSchemas.refreshRequest> }>(
    '/auth/refresh',
    {
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
    },
    async (request, reply) => {
      const body = authSchemas.refreshRequest.parse(request.body);
      const claims = request.server.jwtTokenService.verifyRefreshToken(body.refreshToken);
      const sessionHash = request.server.jwtTokenService.hashTokenValue(body.refreshToken);
      const session = await request.server.authService.findSessionByRefreshTokenHash(claims.tenantId, sessionHash);
      if (!session || !session.isActive || session.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedError('Session is invalid or expired.');
      }
      const user = await request.server.authService.validateSession(claims.sessionId, claims.tenantId);
      if (!user) throw new UnauthorizedError('Session is invalid or expired.');
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
    },
  );

  fastify.get(
    '/auth/me',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Get current authenticated user',
        description: 'Returns the current authenticated user information.',
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema(authSchemas.meResponse), 401: toJsonSchema(errorResponseSchema) },
      },
      preHandler: requireAuth,
    },
    async (request) => {
      if (!request.user) throw new UnauthorizedError('Authentication required.');
      return { success: true, user: sanitizeUser(request.user) };
    },
  );

  fastify.get(
    '/auth/organizations',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'List user organization memberships',
        description: 'Returns all organizations the user has access to and the active organization.',
        security: [{ bearerAuth: [] }],
        response: {
          200: toJsonSchema(
            z.object({
              success: z.boolean(),
              organizations: z.array(
                z.object({
                  id: z.string().uuid(),
                  tenantId: z.string().uuid(),
                  code: z.string(),
                  name: z.string(),
                  status: z.string(),
                  isDefault: z.boolean(),
                }),
              ),
              activeOrganizationId: z.string().uuid().nullable(),
              requiresOrganizationSelection: z.boolean(),
            }),
          ),
          401: toJsonSchema(errorResponseSchema),
        },
      },
      preHandler: requireAuth,
    },
    async (request) => {
      if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
      const memberships = await request.server.tenantMembershipService.resolveOrganizationMemberships(
        request.tenantId,
        request.user.id,
      );
      return {
        success: true,
        organizations: memberships.organizations,
        activeOrganizationId: memberships.activeOrganizationId,
        requiresOrganizationSelection: false,
      };
    },
  );

  fastify.post<{ Body: z.infer<typeof authSchemas.orgSelectRequest> }>(
    '/auth/organizations/select',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Select active organization',
        description: 'Switch the active organization for the current session.',
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(authSchemas.orgSelectRequest),
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
      const body = authSchemas.orgSelectRequest.parse(request.body);
      const requestedOrg = body.organizationId.trim();
      await request.server.tenantMembershipService.resolveOrganizationMemberships(
        request.tenantId,
        request.user.id,
        requestedOrg,
      );
      const result = await request.server.authService.createSessionForUser(
        request.tenantId,
        request.user.id,
        requestedOrg,
      );
      if (!result.success || !result.user || !result.session)
        throw new UnauthorizedError('Failed to create organization session.');
      reply.code(200);
      return {
        success: true,
        user: sanitizeUser(result.user),
        session: sanitizeSession(result.session),
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.session.expiresAt,
        tokenType: 'bearer',
      };
    },
  );

  fastify.post<{ Body: z.infer<typeof authSchemas.contextSelectRequest> }>(
    '/auth/context/select',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Select working context (organization, branch, location)',
        description: 'Establish a complete working context including organization, branch, and location.',
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
    },
    async (request, reply) => {
      if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
      const body = authSchemas.contextSelectRequest.parse(request.body);
      const organizationId = body.organizationId.trim();
      const branchId = body.branchId.trim();
      const locationId = body.locationId.trim();
      const financialYearId = body.financialYearId.trim();

      await request.server.tenantMembershipService.resolveOrganizationMemberships(
        request.tenantId,
        request.user.id,
        organizationId,
      );
      const branch = await request.server.branchService.getAccessibleBranchByIdForUser(
        request.tenantId,
        request.user.id,
        branchId,
        organizationId,
      );
      if (!branch) throw new ForbiddenError('Branch is not available for the selected organization.');
      const financialYearValid = await request.server.branchService.validateFinancialYear(
        request.tenantId,
        organizationId,
        financialYearId,
      );
      if (!financialYearValid) throw new ForbiddenError('Financial year is not available for the selected organization.');
      const location = await request.server.locationService.getAccessibleLocationByIdForUser(
        request.tenantId,
        request.user.id,
        locationId,
        organizationId,
      );
      if (!location) throw new ForbiddenError('Location is not available for the selected organization.');

      const result = await request.server.authService.createSessionForUser(
        request.tenantId,
        request.user.id,
        organizationId,
        location.id,
        branch.id,
        financialYearId,
      );
      if (!result.success || !result.user || !result.session)
        throw new UnauthorizedError('Failed to establish the selected working context.');

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
    },
  );

  fastify.get(
    '/auth/modules',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'List accessible modules for current organization',
        security: [{ bearerAuth: [] }],
        response: {
          200: toJsonSchema(authSchemas.modulesResponse),
          400: toJsonSchema(errorResponseSchema),
          401: toJsonSchema(errorResponseSchema),
        },
      },
      preHandler: requireAuth,
    },
    async (request) => {
      if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
      if (!request.user.organizationId) throw new ValidationError('An active organization is required.');
      const modules = await request.server.moduleAccessService.listAccessibleModules(
        request.tenantId,
        request.user.organizationId,
      );
      return { success: true, organizationId: request.user.organizationId, modules };
    },
  );

  fastify.post<{ Params: ModuleCodeParams }>(
    '/auth/modules/:code/enable',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Enable a module for the organization',
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
    },
    async (request) => {
      if (!request.user || !request.tenantId || !request.user.organizationId) {
        throw new UnauthorizedError('Authentication and organization context are required.');
      }
      const moduleCode = request.params.code.trim();
      const module = await request.server.moduleAccessService.setOrganizationModule(
        request.tenantId,
        request.user.organizationId,
        moduleCode,
        true,
        request.user.id,
      );
      return { success: true, enabled: true, module };
    },
  );

  fastify.post<{ Params: ModuleCodeParams }>(
    '/auth/modules/:code/disable',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Disable a module for the organization',
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
    },
    async (request) => {
      if (!request.user || !request.tenantId || !request.user.organizationId) {
        throw new UnauthorizedError('Authentication and organization context are required.');
      }
      const moduleCode = request.params.code.trim();
      await request.server.moduleAccessService.setOrganizationModule(
        request.tenantId,
        request.user.organizationId,
        moduleCode,
        false,
        request.user.id,
      );
      return { success: true, enabled: false, moduleCode };
    },
  );

  fastify.post(
    '/auth/logout',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Logout and invalidate session',
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema(authSchemas.logoutResponse), 401: toJsonSchema(errorResponseSchema) },
      },
      preHandler: requireAuth,
    },
    async (request) => {
      if (!request.user || !request.sessionId || !request.tenantId)
        throw new UnauthorizedError('Authentication required.');
      await request.server.authService.invalidateSession(request.sessionId, request.tenantId);
      await recordSecurityEvent(request, {
        tenantId: request.tenantId,
        actorUserId: request.user.id,
        action: 'auth.session.logout',
        resourceType: 'session',
        resourceId: request.sessionId,
        outcome: 'success',
        metadata: { sessionId: request.sessionId },
      });
      return { success: true, message: 'Session invalidated.' };
    },
  );

  fastify.get(
    '/auth/protected',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Protected endpoint for testing authentication',
        security: [{ bearerAuth: [] }],
        response: { 401: toJsonSchema(errorResponseSchema) },
      },
      preHandler: requireAuth,
    },
    async (request) => {
      if (!request.user || !request.tenantId || !request.sessionId)
        throw new UnauthorizedError('Authentication required.');
      return {
        success: true,
        user: sanitizeUser(request.user),
        tenantId: request.tenantId,
        sessionId: request.sessionId,
      };
    },
  );
};

export default authRoutes;

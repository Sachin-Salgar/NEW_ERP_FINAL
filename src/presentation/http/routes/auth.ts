import { type FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { ValidationError, UnauthorizedError } from '../../../domain/errors.js';
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
    defaultBranchId: { type: 'string', format: 'uuid' },
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
const selectContextRequestJsonSchema = {
  type: 'object',
  required: ['pendingSelectionToken', 'contextRef'],
  properties: {
    pendingSelectionToken: { type: 'string', minLength: 50, maxLength: 200 },
    contextRef: { type: 'string', minLength: 20, maxLength: 200 },
  },
} as const;
const branchContextSchema = z.object({
  branchId: z.string().uuid(),
  financialYearId: z.string().uuid(),
});
const sanitizeUser = (user: {
  id: string;
  tenantId: string;
  defaultBranchId?: string | null;
  username: string;
  email: string;
  status: string;
}) => ({
  id: user.id,
  tenantId: user.tenantId,
  defaultBranchId: user.defaultBranchId ?? null,
  username: user.username,
  email: user.email,
  status: user.status,
});
const sanitizeSession = (session: {
  id: string;
  tenantId: string;
  userId: string;
  branchId?: string | null;
  financialYearId?: string | null;
  isActive: boolean;
  expiresAt: Date;
  loginAt: Date;
}) => ({
  id: session.id,
  tenantId: session.tenantId,
  userId: session.userId,
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
        platformAdministration: true,
        branchAccess: true,
      },
    }),
  );
  fastify.post<{ Body: { branchId: string; financialYearId: string } }>(
    '/auth/context/branch',
    { preHandler: [requireAuth] },
    async (request) => {
      if (!request.user || !request.tenantId || !request.sessionId)
        throw new UnauthorizedError('Authenticated tenant session is required.');
      const input = branchContextSchema.parse(request.body);
      if (!(await request.server.branchService.validateBranchAccess(request.tenantId, request.user.id, input.branchId)))
        throw new UnauthorizedError('Branch access is not authorized.');
      if (!(await request.server.branchService.validateFinancialYear(
        request.tenantId,
        input.financialYearId,
        input.branchId,
      )))
        throw new ValidationError('Financial Year is not valid for the selected branch.');
      const session = await request.server.authService.updateBranchContext(
        request.sessionId,
        request.tenantId,
        request.user.id,
        input.branchId,
        input.financialYearId,
      );
      if (!session) throw new UnauthorizedError('Authenticated session could not be updated.');
      return { success: true, session };
    },
  );
  fastify.post<{ Body: { identifier: string; password: string } }>(
    '/auth/platform-login',
    { bodyLimit: 10 * 1024, config: { rateLimit: authRateLimit(fastify, fastify.appConfig.AUTH_LOGIN_RATE_LIMIT) } },
    async (request, reply) => {
      const identifier = request.body.identifier.trim();
      const candidate = await request.server.dbPool.query<{
        identityId: string;
        secretHash: string;
        membershipId: string;
      }>(
        `SELECT i.identity_id AS "identityId", c.secret_hash AS "secretHash", m.id AS "membershipId"
       FROM auth_login_identifiers i
       JOIN identity_credentials c ON c.identity_id = i.identity_id AND c.provider = 'local' AND c.credential_type = 'password' AND c.status = 'active'
       JOIN identities x ON x.id = i.identity_id AND x.status = 'active'
       JOIN platform_memberships m ON m.identity_id = x.id AND m.status = 'active'
       WHERE i.identifier = $1::citext AND i.is_active = true
       LIMIT 1`,
        [identifier],
      );
      if (candidate.rowCount !== 1 || !(await compare(request.body.password, candidate.rows[0].secretHash)))
        throw new UnauthorizedError('Invalid credentials.');
      const sessionId = crypto.randomUUID();
      const refreshToken = request.server.jwtTokenService.createRefreshToken({
        userId: candidate.rows[0].identityId,
        identityId: candidate.rows[0].identityId,
        tenantId: null,
        sessionId,
        contextType: 'platform',
        membershipId: candidate.rows[0].membershipId,
      });
      const sessionClient = await request.server.dbPool.connect();
      try {
        await sessionClient.query('BEGIN');
        await sessionClient.query(`SELECT set_config('app.platform_session_enabled', 'true', true)`);
        await sessionClient.query(
          `INSERT INTO user_sessions (id, context_type, tenant_id, user_id, identity_id, tenant_membership_id, platform_membership_id, refresh_token_hash, is_active, expires_at, login_at, last_activity_at, updated_at, version, security_version)
         VALUES ($1, 'platform', NULL, NULL, $2, NULL, $3, $4, true, NOW() + INTERVAL '14 days', NOW(), NOW(), NOW(), 1, 1)`,
          [
            sessionId,
            candidate.rows[0].identityId,
            candidate.rows[0].membershipId,
            request.server.jwtTokenService.hashTokenValue(refreshToken),
          ],
        );
        await sessionClient.query('COMMIT');
      } catch (error) {
        await sessionClient.query('ROLLBACK');
        throw error;
      } finally {
        sessionClient.release();
      }
      const accessToken = request.server.jwtTokenService.createAccessToken({
        userId: candidate.rows[0].identityId,
        identityId: candidate.rows[0].identityId,
        tenantId: null,
        sessionId,
        contextType: 'platform',
        membershipId: candidate.rows[0].membershipId,
      });
      reply.code(200);
      return { success: true, contextType: 'platform', tenantId: null, accessToken, refreshToken, tokenType: 'bearer' };
    },
  );
  fastify.post<{ Body: z.infer<typeof authSchemas.registerRequest> }>(
    '/auth/register',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        description: 'Register a new user within the current tenant. Requires user.create permission.',
        security: [{ bearerAuth: [] }],
        body: registerRequestJsonSchema,
      },
      bodyLimit: 10 * 1024,
      config: { rateLimit: authRateLimit(fastify, fastify.appConfig.AUTH_REGISTER_RATE_LIMIT) },
      preHandler: [requireAuth, requirePermission('user.create')],
    },
    async (request, reply) => {
      const body = authSchemas.registerRequest.parse(request.body);
      const tenantId = request.tenantId;
      if (!tenantId || !request.user) throw new ValidationError('Tenant context is required for registration.');
      const newUser = await request.server.registrationService.registerUser(tenantId, request.user.id, {
        username: body.username,
        email: body.email,
        password: body.password,
        defaultBranchId: body.defaultBranchId ?? request.user.defaultBranchId ?? null,
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
    async (request) => {
      const body = authSchemas.loginRequest.parse(request.body);
      const result = await request.server.unifiedAuthenticationService.authenticate(body.identifier.trim(), body.password);
      if (result.resolution === 'ZERO') {
        if (result.failureTenantId) {
          await recordSecurityEvent(request, {
            tenantId: result.failureTenantId,
            actorUserId: result.failureUserId,
            action: 'auth.login.failure',
            resourceType: 'session',
            outcome: 'failure',
            metadata: { reason: result.reason ?? 'INVALID_CREDENTIALS' },
          });
        }
        throw new UnauthorizedError('Invalid credentials.');
      }
      if (result.resolution === 'SELECT') {
        return {
          success: true,
          resolution: 'SELECT' as const,
          contexts: result.contexts,
          pendingSelectionToken: result.pendingSelectionToken,
        };
      }
      if (!result.authentication) throw new UnauthorizedError('Invalid credentials.');
      const authentication = result.authentication;
      if (result.context?.contextType === 'tenant') {
        if (!authentication.user || !authentication.session || !authentication.accessToken || !authentication.refreshToken)
          throw new UnauthorizedError('Invalid credentials.');
        await recordSecurityEvent(request, {
          tenantId: authentication.user.tenantId,
          actorUserId: authentication.user.id,
          action: 'auth.login.success',
          resourceType: 'session',
          resourceId: authentication.session.id,
          outcome: 'success',
          metadata: { sessionId: authentication.session.id, contextType: 'tenant' },
        });
        return {
          success: true,
          resolution: 'DIRECT' as const,
          user: sanitizeUser(authentication.user),
          session: sanitizeSession(authentication.session),
          accessToken: authentication.accessToken,
          refreshToken: authentication.refreshToken,
          expiresAt: authentication.session.expiresAt,
          tokenType: 'bearer',
          contextType: 'tenant' as const,
          destination: '/dashboard' as const,
          tenant: { id: authentication.user.tenantId },
        };
      }
      if (!authentication.session || !authentication.accessToken || !authentication.refreshToken)
        throw new UnauthorizedError('Invalid credentials.');
      return {
        success: true,
        resolution: 'DIRECT' as const,
        contextType: 'platform' as const,
        destination: '/platform' as const,
        tenantId: null,
        accessToken: authentication.accessToken,
        refreshToken: authentication.refreshToken,
        expiresAt: authentication.session.expiresAt,
        tokenType: 'bearer',
      };
    },
  );
  fastify.post<{
    Body: {     pendingSelectionToken: string; contextRef: string };
  }>(
    '/auth/select-context',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Complete pending login context selection',
        body: selectContextRequestJsonSchema,
      },
      bodyLimit: 10 * 1024,
      config: { rateLimit: authRateLimit(fastify, fastify.appConfig.AUTH_LOGIN_RATE_LIMIT) },
    },
    async (request) => {
      const body = z
        .object({
          pendingSelectionToken: z.string().min(50).max(200),
          contextRef: z.string().min(20).max(200),
        })
        .parse(request.body);
      const result = await request.server.unifiedAuthenticationService.selectContext(
        body.pendingSelectionToken,
        body.contextRef,
      );
      if (result.resolution !== 'DIRECT' || !result.authentication || !result.context)
        throw new UnauthorizedError('Login context is invalid or expired.');
      const authentication = result.authentication;
      if (result.context.contextType === 'tenant') {
        if (!authentication.user || !authentication.session || !authentication.accessToken || !authentication.refreshToken)
          throw new UnauthorizedError('Login context is invalid or expired.');
        return {
          success: true,
          resolution: 'DIRECT' as const,
          user: sanitizeUser(authentication.user),
          session: sanitizeSession(authentication.session),
          accessToken: authentication.accessToken,
          refreshToken: authentication.refreshToken,
          expiresAt: authentication.session.expiresAt,
          tokenType: 'bearer',
          contextType: 'tenant' as const,
          destination: '/dashboard' as const,
          tenant: { id: authentication.user.tenantId },
        };
      }
      if (!authentication.session || !authentication.accessToken || !authentication.refreshToken)
        throw new UnauthorizedError('Login context is invalid or expired.');
      return {
        success: true,
        resolution: 'DIRECT' as const,
        contextType: 'platform' as const,
        destination: '/platform' as const,
        tenantId: null,
        accessToken: authentication.accessToken,
        refreshToken: authentication.refreshToken,
        expiresAt: authentication.session.expiresAt,
        tokenType: 'bearer',
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
      if (claims.contextType === 'platform') {
        const session = await request.server.dbPool.query<{ platformMembershipId: string; identityId: string }>(
          `SELECT platform_membership_id AS "platformMembershipId", identity_id AS "identityId" FROM user_sessions WHERE id = $1 AND context_type = 'platform' AND refresh_token_hash = $2 AND is_active = true AND expires_at > NOW()`,
          [claims.sessionId, sessionHash],
        );
        if (session.rowCount !== 1) throw new UnauthorizedError('Session is invalid or expired.');
        const context = await request.server.platformAuthorizationService.validateContext(
          claims.sessionId,
          session.rows[0].identityId,
        );
        if (!context) throw new UnauthorizedError('Session is invalid or expired.');
        const accessToken = request.server.jwtTokenService.createAccessToken({
          userId: claims.sub,
          identityId: session.rows[0].identityId,
          tenantId: null,
          sessionId: claims.sessionId,
          contextType: 'platform',
          membershipId: session.rows[0].platformMembershipId,
          expiresInSeconds: 60 * 60,
        });
        reply.code(200);
        return {
          success: true,
          contextType: 'platform',
          tenantId: null,
          accessToken,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          tokenType: 'bearer',
        };
      }
      if (!claims.tenantId) throw new UnauthorizedError('Session is invalid or expired.');
      const session = await request.server.authService.findSessionByRefreshTokenHash(claims.tenantId, sessionHash);
      if (!session || !session.isActive || session.expiresAt.getTime() <= Date.now())
        throw new UnauthorizedError('Session is invalid or expired.');
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
    '/auth/modules',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'List accessible modules for current tenant',
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
      const modules = await request.server.moduleAccessService.listAccessibleModules(request.tenantId);
      return { success: true, tenantId: request.tenantId, modules };
    },
  );
  fastify.post<{ Params: ModuleCodeParams }>(
    '/auth/modules/:code/enable',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Enable a module for the tenant',
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(z.object({ code: z.string().min(1) })),
        response: {
          200: toJsonSchema(authSchemas.moduleToggleResponse),
          400: toJsonSchema(errorResponseSchema),
          401: toJsonSchema(errorResponseSchema),
          403: toJsonSchema(errorResponseSchema),
        },
      },
      preHandler: [requireAuth, requirePermission('tenant.update')],
    },
    async (request) => {
      if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
      const moduleCode = request.params.code.trim();
      const module = await request.server.moduleAccessService.setTenantModule(request.tenantId, moduleCode, true, request.user.id);
      return { success: true, enabled: true, module };
    },
  );
  fastify.post<{ Params: ModuleCodeParams }>(
    '/auth/modules/:code/disable',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Disable a module for the tenant',
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(z.object({ code: z.string().min(1) })),
        response: {
          200: toJsonSchema(authSchemas.moduleToggleResponse),
          400: toJsonSchema(errorResponseSchema),
          401: toJsonSchema(errorResponseSchema),
          403: toJsonSchema(errorResponseSchema),
        },
      },
      preHandler: [requireAuth, requirePermission('tenant.update')],
    },
    async (request) => {
      if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
      const moduleCode = request.params.code.trim();
      await request.server.moduleAccessService.setTenantModule(request.tenantId, moduleCode, false, request.user.id);
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

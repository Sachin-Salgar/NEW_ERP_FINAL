import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ForbiddenError, NotFoundError, ValidationError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { errorResponseSchema, toJsonSchema } from '../swagger.js';
import { recordSecurityEvent } from '../security-audit.js';

const sessionParams = z.object({ sessionId: z.string().uuid() });
const userParams = z.object({ userId: z.string().uuid() });
const listQuery = z.object({
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const securityAdministrationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/security/sessions',
    {
      schema: {
        tags: ['Security'],
        summary: 'List active tenant sessions',
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema(z.object({ success: z.literal(true), sessions: z.array(z.unknown()) })), 401: toJsonSchema(errorResponseSchema) },
      },
      preHandler: [requireAuth, requirePermission('security.session.read')],
    },
    async (request) => {
      if (!request.tenantId) throw new ValidationError('Tenant context is required.');
      const query = listQuery.parse(request.query);
      const sessions = await request.server.securityAdministrationService.listActiveSessions(request.tenantId, query.userId);
      return { success: true as const, sessions };
    },
  );

  fastify.post(
    '/security/sessions/:sessionId/revoke',
    {
      schema: {
        tags: ['Security'],
        summary: 'Revoke one tenant session',
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(sessionParams),
        response: { 200: toJsonSchema(z.object({ success: z.literal(true), revoked: z.literal(true) })), 401: toJsonSchema(errorResponseSchema), 404: toJsonSchema(errorResponseSchema) },
      },
      preHandler: [requireAuth, requirePermission('security.session.revoke')],
    },
    async (request) => {
      if (!request.tenantId) throw new ValidationError('Tenant context is required.');
      const { sessionId } = sessionParams.parse(request.params);
      if (sessionId === request.sessionId) throw new ForbiddenError('The current session must be ended through logout.');
      const session = await request.server.authService.getSession(sessionId, request.tenantId);
      if (!session) throw new NotFoundError('Session not found.');
      await request.server.securityAdministrationService.revokeSession(sessionId, request.tenantId);
      await recordSecurityEvent(request, {
        tenantId: request.tenantId,
        actorUserId: request.user?.id,
        action: 'security.session.revoke',
        resourceType: 'session',
        resourceId: sessionId,
        outcome: 'success',
        metadata: { userId: session.userId },
      });
      return { success: true as const, revoked: true as const };
    },
  );

  fastify.post(
    '/security/users/:userId/sessions/revoke-all',
    {
      schema: {
        tags: ['Security'],
        summary: 'Revoke all sessions for a tenant user',
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(userParams),
        response: { 200: toJsonSchema(z.object({ success: z.literal(true), revoked: z.number().int().nonnegative() })), 401: toJsonSchema(errorResponseSchema) },
      },
      preHandler: [requireAuth, requirePermission('security.session.revoke_all')],
    },
    async (request) => {
      if (!request.tenantId) throw new ValidationError('Tenant context is required.');
      const { userId } = userParams.parse(request.params);
      const revoked = await request.server.securityAdministrationService.revokeAllSessions(
        request.tenantId,
        userId,
        request.user?.id === userId ? request.sessionId : undefined,
      );
      await recordSecurityEvent(request, {
        tenantId: request.tenantId,
        actorUserId: request.user?.id,
        action: 'security.session.revoke_all',
        resourceType: 'session',
        resourceId: userId,
        outcome: 'success',
        metadata: { revoked },
      });
      return { success: true as const, revoked };
    },
  );

  fastify.get(
    '/security/audit-logs',
    {
      schema: {
        tags: ['Security'],
        summary: 'Read tenant audit logs',
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema(z.object({ success: z.literal(true), logs: z.array(z.unknown()) })), 401: toJsonSchema(errorResponseSchema) },
      },
      preHandler: [requireAuth, requirePermission('security.audit_log.read')],
    },
    async (request) => {
      if (!request.tenantId) throw new ValidationError('Tenant context is required.');
      const query = listQuery.parse(request.query);
      const logs = await request.server.securityAdministrationService.listAuditLogs(request.tenantId, query.limit, 0);
      return { success: true as const, logs };
    },
  );
};

export default securityAdministrationRoutes;

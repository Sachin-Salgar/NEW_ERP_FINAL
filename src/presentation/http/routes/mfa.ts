import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { UnauthorizedError, ValidationError } from '../../../domain/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { errorResponseSchema, toJsonSchema } from '../swagger.js';
import { recordSecurityEvent } from '../security-audit.js';

const beginSchema = z.object({ accountLabel: z.string().trim().min(1).max(254).optional() });
const codeSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'MFA code must contain exactly 6 digits'),
});
const recoveryOrCodeSchema = z.object({ token: z.string().trim().min(6).max(128) });

const mfaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof beginSchema> }>(
    '/auth/mfa/enroll',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Begin MFA enrollment for the current user',
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(beginSchema),
        response: {
          200: toJsonSchema(
            z.object({
              success: z.literal(true),
              secret: z.string(),
              otpauthUri: z.string(),
              expiresAt: z.string().datetime(),
            }),
          ),
          401: toJsonSchema(errorResponseSchema),
        },
      },
      preHandler: requireAuth,
    },
    async (request) => {
      if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
      const body = beginSchema.parse(request.body ?? {});
      const result = await request.server.mfaService.beginEnrollment(
        request.tenantId,
        request.user.id,
        body.accountLabel ?? request.user.email,
      );
      await recordSecurityEvent(request, {
        tenantId: request.tenantId,
        actorUserId: request.user.id,
        action: 'auth.mfa.enrollment.begin',
        resourceType: 'mfa',
        resourceId: request.user.id,
        outcome: 'success',
      });
      return {
        success: true as const,
        secret: result.secret,
        otpauthUri: result.otpauthUri,
        expiresAt: result.expiresAt.toISOString(),
      };
    },
  );

  fastify.post<{ Body: z.infer<typeof codeSchema> }>(
    '/auth/mfa/enroll/confirm',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Confirm MFA enrollment',
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(codeSchema),
        response: {
          200: toJsonSchema(z.object({ success: z.literal(true), recoveryCodes: z.array(z.string()) })),
          400: toJsonSchema(errorResponseSchema),
          401: toJsonSchema(errorResponseSchema),
        },
      },
      preHandler: requireAuth,
    },
    async (request) => {
      if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
      const body = codeSchema.parse(request.body);
      try {
        const recoveryCodes = await request.server.mfaService.confirmEnrollment(
          request.tenantId,
          request.user.id,
          body.token,
        );
        await recordSecurityEvent(request, {
          tenantId: request.tenantId,
          actorUserId: request.user.id,
          action: 'auth.mfa.enrollment.confirm',
          resourceType: 'mfa',
          resourceId: request.user.id,
          outcome: 'success',
        });
        return { success: true as const, recoveryCodes };
      } catch (error) {
        await recordSecurityEvent(request, {
          tenantId: request.tenantId,
          actorUserId: request.user.id,
          action: 'auth.mfa.enrollment.confirm',
          resourceType: 'mfa',
          resourceId: request.user.id,
          outcome: 'failure',
          metadata: { reason: 'invalid_or_expired' },
        });
        if (error instanceof ValidationError) throw error;
        throw new ValidationError('MFA enrollment code is invalid or the enrollment has expired.');
      }
    },
  );

  fastify.post<{ Body: z.infer<typeof recoveryOrCodeSchema> }>(
    '/auth/mfa/verify',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Verify MFA code or one-time recovery code',
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(recoveryOrCodeSchema),
        response: {
          200: toJsonSchema(z.object({ success: z.literal(true), verified: z.boolean() })),
          401: toJsonSchema(errorResponseSchema),
        },
      },
      preHandler: requireAuth,
    },
    async (request) => {
      if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
      const body = recoveryOrCodeSchema.parse(request.body);
      const verified = await request.server.mfaService.verify(request.tenantId, request.user.id, body.token);
      await recordSecurityEvent(request, {
        tenantId: request.tenantId,
        actorUserId: request.user.id,
        action: 'auth.mfa.verify',
        resourceType: 'mfa',
        resourceId: request.user.id,
        outcome: verified ? 'success' : 'failure',
        metadata: { reason: verified ? null : 'invalid_code_or_recovery_code' },
      });
      return { success: true as const, verified };
    },
  );

  fastify.post(
    '/auth/mfa/disable',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Disable MFA for the current user',
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema(z.object({ success: z.literal(true) })), 401: toJsonSchema(errorResponseSchema) },
      },
      preHandler: requireAuth,
    },
    async (request) => {
      if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
      await request.server.mfaService.disable(request.tenantId, request.user.id);
      await recordSecurityEvent(request, {
        tenantId: request.tenantId,
        actorUserId: request.user.id,
        action: 'auth.mfa.disable',
        resourceType: 'mfa',
        resourceId: request.user.id,
        outcome: 'success',
      });
      return { success: true as const };
    },
  );
};

export default mfaRoutes;

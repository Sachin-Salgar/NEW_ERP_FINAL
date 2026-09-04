import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { UnauthorizedError, ValidationError } from '../../../domain/errors.js';
import { validatePassword } from '../../../infrastructure/security/password-policy.js';
import { requireAuth } from '../middleware/auth.js';
import { errorResponseSchema, toJsonSchema } from '../swagger.js';

const requestVerificationSchema = z.object({ identifier: z.string().trim().min(1).max(254) });
const verifyEmailSchema = z.object({ token: z.string().trim().min(16).max(512) });
const requestResetSchema = z.object({ identifier: z.string().trim().min(1).max(254) });
const resetPasswordSchema = z.object({
  token: z.string().trim().min(16).max(512),
  newPassword: z.string().min(8).max(128),
});

const okResponse = toJsonSchema(z.object({ success: z.literal(true) }));

const accountSecurityRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof requestVerificationSchema> }>('/auth/email-verification/request', {
    schema: {
      tags: ['Authentication'],
      summary: 'Request email verification',
      body: toJsonSchema(requestVerificationSchema),
      response: { 200: okResponse, 400: toJsonSchema(errorResponseSchema) },
    },
    config: { rateLimit: { max: fastify.appConfig.AUTH_LOGIN_RATE_LIMIT, timeWindow: fastify.appConfig.AUTH_RATE_LIMIT_WINDOW_MS } },
  }, async (request) => {
    const body = requestVerificationSchema.parse(request.body);
    const tenantId = request.headers['x-tenant-id'];
    if (typeof tenantId !== 'string' || !z.string().uuid().safeParse(tenantId).success) {
      throw new ValidationError('Tenant context is required for email verification.');
    }
    await request.server.accountSecurityService.requestEmailVerification(tenantId, body.identifier);
    return { success: true as const };
  });

  fastify.post<{ Body: z.infer<typeof verifyEmailSchema> }>('/auth/email-verification/confirm', {
    schema: {
      tags: ['Authentication'],
      summary: 'Confirm email verification token',
      body: toJsonSchema(verifyEmailSchema),
      response: { 200: okResponse, 400: toJsonSchema(errorResponseSchema) },
    },
  }, async (request) => {
    const body = verifyEmailSchema.parse(request.body);
    const tenantId = request.headers['x-tenant-id'];
    if (typeof tenantId !== 'string' || !z.string().uuid().safeParse(tenantId).success) {
      throw new ValidationError('Tenant context is required for email verification.');
    }
    const verified = await request.server.accountSecurityService.verifyEmail(tenantId, body.token);
    if (!verified) throw new ValidationError('Email verification token is invalid or expired.');
    return { success: true as const };
  });

  fastify.post<{ Body: z.infer<typeof requestResetSchema> }>('/auth/password-recovery/request', {
    schema: {
      tags: ['Authentication'],
      summary: 'Request password recovery',
      body: toJsonSchema(requestResetSchema),
      response: { 200: okResponse, 400: toJsonSchema(errorResponseSchema) },
    },
    config: { rateLimit: { max: fastify.appConfig.AUTH_LOGIN_RATE_LIMIT, timeWindow: fastify.appConfig.AUTH_RATE_LIMIT_WINDOW_MS } },
  }, async (request) => {
    const body = requestResetSchema.parse(request.body);
    // Deliberately return the same success response whether or not the identity exists.
    await request.server.accountSecurityService.requestPasswordReset(body.identifier);
    return { success: true as const };
  });

  fastify.post<{ Body: z.infer<typeof resetPasswordSchema> }>('/auth/password-recovery/reset', {
    schema: {
      tags: ['Authentication'],
      summary: 'Reset password with a single-use recovery token',
      body: toJsonSchema(resetPasswordSchema),
      response: { 200: okResponse, 400: toJsonSchema(errorResponseSchema) },
    },
  }, async (request) => {
    const body = resetPasswordSchema.parse(request.body);
    const tenantId = request.headers['x-tenant-id'];
    if (typeof tenantId !== 'string' || !z.string().uuid().safeParse(tenantId).success) {
      throw new ValidationError('Tenant context is required for password reset.');
    }

    const issues = validatePassword(body.newPassword, {
      minLength: fastify.appConfig.AUTH_PASSWORD_MIN_LENGTH,
      requireUppercase: fastify.appConfig.AUTH_PASSWORD_REQUIRE_UPPERCASE,
      requireLowercase: fastify.appConfig.AUTH_PASSWORD_REQUIRE_LOWERCASE,
      requireNumber: fastify.appConfig.AUTH_PASSWORD_REQUIRE_NUMBER,
      requireSymbol: fastify.appConfig.AUTH_PASSWORD_REQUIRE_SYMBOL,
    });
    if (issues.length) throw new ValidationError(issues.join(' '));

    const reset = await request.server.accountSecurityService.resetPassword(tenantId, body.token, body.newPassword);
    if (!reset) throw new UnauthorizedError('Password reset token is invalid or expired.');
    return { success: true as const };
  });

  fastify.post('/auth/email-verification/request-authenticated', {
    schema: {
      tags: ['Authentication'],
      summary: 'Request email verification for the current user',
      security: [{ bearerAuth: [] }],
      response: { 200: okResponse, 401: toJsonSchema(errorResponseSchema) },
    },
    preHandler: requireAuth,
  }, async (request) => {
    if (!request.user || !request.tenantId) throw new UnauthorizedError('Authentication required.');
    await request.server.accountSecurityService.requestEmailVerification(request.tenantId, request.user.email);
    return { success: true as const };
  });
};

export default accountSecurityRoutes;

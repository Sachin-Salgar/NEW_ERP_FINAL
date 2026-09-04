import { type Pool } from 'pg';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

import { isCorsOriginAllowed, type AppConfig } from '../../config/schema.js';
import { AuthenticationService } from '../../application/services/authentication-service.js';
import { AuthorizationService } from '../../application/services/authorization-service.js';
import { BranchService } from '../../application/services/branch-service.js';
import { CoreEnterpriseService } from '../../application/services/core-enterprise-service.js';
import { LocationService } from '../../application/services/location-service.js';
import { ModuleAccessService } from '../../application/services/module-access-service.js';
import { RefreshTokenRotationService } from '../../application/services/refresh-token-rotation-service.js';
import { TenantMembershipService } from '../../application/services/tenant-membership-service.js';
import { UserRegistrationService } from '../../application/services/user-registration-service.js';
import { AccountSecurityService } from '../../application/services/account-security-service.js';
import { MfaService } from '../../application/services/mfa-service.js';
import { createDatabasePool } from '../../infrastructure/database/connection.js';
import { IdentityAwarePostgresPlatformRepository } from '../../infrastructure/database/repositories/identity-aware-postgres-platform-repository.js';
import { PostgresAccountSecurityRepository } from '../../infrastructure/database/repositories/postgres-account-security-repository.js';
import { PostgresMfaRepository } from '../../infrastructure/database/repositories/postgres-mfa-repository.js';
import { PostgresNotificationService } from '../../infrastructure/database/repositories/postgres-operational-services.js';
import { AccountSecurityNotificationAdapter } from '../../application/adapters/account-security-notifications.js';
import { buildErrorHandler } from '../../infrastructure/http/error-handler.js';
import { applyCorrelationIdHooks } from '../../infrastructure/http/correlation-id.js';
import { BcryptPasswordHasher } from '../../infrastructure/security/bcrypt-password-hasher.js';
import { AesGcmSecretProtector } from '../../infrastructure/security/aes-secret-protector.js';
import { Rfc6238TotpProvider } from '../../infrastructure/security/totp.js';
import { JwtTokenService } from '../../infrastructure/security/jwt-token-service.js';
import { UnitOfWork } from '../../infrastructure/database/unit-of-work.js';
import { createLogger } from '../../infrastructure/logging/logger.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import accountSecurityRoutes from './routes/account-security.js';
import mfaRoutes from './routes/mfa.js';
import branchRoutes from './routes/branch.js';
import coreEnterpriseRoutes from './routes/core-enterprise.js';
import jwksRoutes from './routes/jwks.js';
import locationRoutes from './routes/location.js';
import rbacRoutes from './routes/rbac.js';
import { paginateListResponse } from './pagination.js';
import { schemaForRoute, setupSwagger } from './swagger.js';

const rotatedRefreshResponseSchema = {
  type: 'object', required: ['success', 'accessToken', 'refreshToken', 'expiresAt', 'tokenType', 'user'],
  properties: {
    success: { type: 'boolean', const: true }, accessToken: { type: 'string' }, refreshToken: { type: 'string' },
    expiresAt: { type: 'string', format: 'date-time' }, tokenType: { type: 'string', const: 'bearer' },
    user: { type: 'object', required: ['id', 'tenantId', 'organizationId', 'activeLocationId', 'defaultLocationId', 'defaultBranchId', 'username', 'email', 'status'], properties: {
      id: { type: 'string', format: 'uuid' }, tenantId: { type: 'string', format: 'uuid' }, organizationId: { type: ['string', 'null'], format: 'uuid' },
      activeLocationId: { type: ['string', 'null'], format: 'uuid' }, defaultLocationId: { type: ['string', 'null'], format: 'uuid' }, defaultBranchId: { type: ['string', 'null'], format: 'uuid' },
      username: { type: 'string' }, email: { type: 'string', format: 'email' }, status: { type: 'string' },
    } },
  },
} as const;

export async function createApplication(config: AppConfig, providedPool?: Pool): Promise<FastifyInstance> {
  const app = Fastify({ logger: createLogger(config), requestIdHeader: 'x-request-id', requestIdLogLabel: 'requestId', ignoreTrailingSlash: true, bodyLimit: 1024 * 1024,
    ajv: { customOptions: { allErrors: true, coerceTypes: true, removeAdditional: false } } });

  app.addHook('onRoute', (routeOptions) => {
    routeOptions.schema = { ...routeOptions.schema, ...schemaForRoute(routeOptions.method as string, routeOptions.url) };
    if (String(routeOptions.method).includes('POST') && routeOptions.url.replace(/\/$/, '').endsWith('/auth/refresh')) {
      const existingResponse = (routeOptions.schema?.response ?? {}) as Record<string | number, unknown>;
      routeOptions.schema = { ...routeOptions.schema, response: { ...existingResponse, 200: rotatedRefreshResponseSchema } };
    }
  });

  app.addHook('onSend', async (request, _reply, payload) => {
    if (request.method !== 'GET' || request.url.includes('/rbac/roles') || request.url.includes('/rbac/permissions')) return payload;
    if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) return payload;
    const raw = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
    if (!raw.trim().startsWith('{')) return payload;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return JSON.stringify(paginateListResponse(request.url, parsed, request.query));
  });

  applyCorrelationIdHooks(app);
  const pool = providedPool ?? createDatabasePool(config);
  const repository = new IdentityAwarePostgresPlatformRepository(pool);
  const passwordHasher = new BcryptPasswordHasher();
  const jwtTokenService = new JwtTokenService(config);
  const authService = new AuthenticationService(repository, passwordHasher, jwtTokenService, { maxFailedAttempts: config.AUTH_MAX_FAILED_ATTEMPTS, lockoutMinutes: config.AUTH_LOCKOUT_MINUTES });
  const authorizationService = new AuthorizationService(repository);
  const branchService = new BranchService(repository);
  const coreEnterpriseService = new CoreEnterpriseService(repository);
  const locationService = new LocationService(repository);
  const moduleAccessService = new ModuleAccessService(pool);
  const transactionRunner = new UnitOfWork(pool);
  const refreshTokenRotationService = new RefreshTokenRotationService(pool, config.TENANT_CONTEXT_KEY, jwtTokenService);
  const registrationService = new UserRegistrationService(repository, passwordHasher, {
    minLength: config.AUTH_PASSWORD_MIN_LENGTH, requireUppercase: config.AUTH_PASSWORD_REQUIRE_UPPERCASE, requireLowercase: config.AUTH_PASSWORD_REQUIRE_LOWERCASE,
    requireNumber: config.AUTH_PASSWORD_REQUIRE_NUMBER, requireSymbol: config.AUTH_PASSWORD_REQUIRE_SYMBOL,
  }, transactionRunner);
  const tenantMembershipService = new TenantMembershipService(repository);

  const accountSecurityRepository = new PostgresAccountSecurityRepository(pool, config.TENANT_CONTEXT_KEY);
  const notificationService = new PostgresNotificationService(pool, config.TENANT_CONTEXT_KEY);
  const accountSecurityService = new AccountSecurityService(accountSecurityRepository, passwordHasher, new AccountSecurityNotificationAdapter(notificationService));
  const mfaRepository = new PostgresMfaRepository(pool, config.TENANT_CONTEXT_KEY);
  const mfaKey = process.env.MFA_ENCRYPTION_KEY ?? (config.isProduction ? '' : 'development-mfa-encryption-key-change-me-32');
  const mfaService = new MfaService(mfaRepository, new Rfc6238TotpProvider(), new AesGcmSecretProtector(mfaKey), { issuer: config.APP_NAME });

  app.decorate('appConfig', config); app.decorate('dbPool', pool); app.decorate('authService', authService); app.decorate('authorizationService', authorizationService);
  app.decorate('branchService', branchService); app.decorate('coreEnterpriseService', coreEnterpriseService); app.decorate('locationService', locationService);
  app.decorate('moduleAccessService', moduleAccessService); app.decorate('registrationService', registrationService); app.decorate('jwtTokenService', jwtTokenService);
  app.decorate('tenantMembershipService', tenantMembershipService); app.decorate('accountSecurityService', accountSecurityService); app.decorate('mfaService', mfaService);

  app.addHook('preHandler', async (request, reply) => {
    if (request.method !== 'POST' || !request.routeOptions.url.replace(/\/$/, '').endsWith('/auth/refresh')) return;
    const body = request.body as { refreshToken?: unknown };
    if (typeof body?.refreshToken !== 'string' || body.refreshToken.length === 0) return;
    const rotated = await refreshTokenRotationService.rotate(body.refreshToken);
    const user = await authService.validateSession(rotated.sessionId, rotated.tenantId);
    if (!user) throw new Error('Rotated session could not be resolved');
    return reply.code(200).send({ success: true, accessToken: rotated.accessToken, refreshToken: rotated.refreshToken, expiresAt: rotated.accessTokenExpiresAt, tokenType: 'bearer', user: {
      id: user.id, tenantId: user.tenantId, organizationId: user.organizationId ?? null, activeLocationId: user.activeLocationId ?? null,
      defaultLocationId: user.defaultLocationId ?? null, defaultBranchId: user.defaultBranchId ?? null, username: user.username, email: user.email, status: user.status,
    } });
  });

  await app.register(cors, { origin: (origin, callback) => callback(null, isCorsOriginAllowed(config, origin)), methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'], credentials: true, optionsSuccessStatus: 204 });
  await app.register(rateLimit, { global: false, keyGenerator: (request) => request.ip, errorResponseBuilder: (_request, context) => Object.assign(new Error(`Too many requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`), { code: 'RATE_LIMIT_EXCEEDED', statusCode: context.statusCode }) });
  await setupSwagger(app);
  app.setErrorHandler(buildErrorHandler(config));
  await app.register(jwksRoutes);
  await app.register(healthRoutes, { prefix: config.API_PREFIX });
  await app.register(authRoutes, { prefix: config.API_PREFIX });
  await app.register(accountSecurityRoutes, { prefix: config.API_PREFIX });
  await app.register(mfaRoutes, { prefix: config.API_PREFIX });
  await app.register(rbacRoutes, { prefix: config.API_PREFIX });
  await app.register(branchRoutes, { prefix: config.API_PREFIX });
  await app.register(coreEnterpriseRoutes, { prefix: config.API_PREFIX });
  await app.register(locationRoutes, { prefix: config.API_PREFIX });
  return app;
}

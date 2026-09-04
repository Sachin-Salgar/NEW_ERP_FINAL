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
import { TenantMembershipService } from '../../application/services/tenant-membership-service.js';
import { UserRegistrationService } from '../../application/services/user-registration-service.js';
import { createDatabasePool } from '../../infrastructure/database/connection.js';
import { IdentityAwarePostgresPlatformRepository } from '../../infrastructure/database/repositories/identity-aware-postgres-platform-repository.js';
import { buildErrorHandler } from '../../infrastructure/http/error-handler.js';
import { applyCorrelationIdHooks } from '../../infrastructure/http/correlation-id.js';
import { BcryptPasswordHasher } from '../../infrastructure/security/bcrypt-password-hasher.js';
import { JwtTokenService } from '../../infrastructure/security/jwt-token-service.js';
import { UnitOfWork } from '../../infrastructure/database/unit-of-work.js';
import { createLogger } from '../../infrastructure/logging/logger.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import branchRoutes from './routes/branch.js';
import coreEnterpriseRoutes from './routes/core-enterprise.js';
import locationRoutes from './routes/location.js';
import rbacRoutes from './routes/rbac.js';
import { schemaForRoute, setupSwagger } from './swagger.js';

export async function createApplication(config: AppConfig, providedPool?: Pool): Promise<FastifyInstance> {
  const app = Fastify({
    logger: createLogger(config),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    ignoreTrailingSlash: true,
    bodyLimit: 1024 * 1024,
    ajv: {
      customOptions: {
        allErrors: true,
        coerceTypes: true,
        removeAdditional: false,
      },
    },
  });

  app.addHook('onRoute', (routeOptions) => {
    routeOptions.schema = {
      ...routeOptions.schema,
      ...schemaForRoute(routeOptions.method as string, routeOptions.url),
    };
  });

  applyCorrelationIdHooks(app);

  const pool = providedPool ?? createDatabasePool(config);
  const repository = new IdentityAwarePostgresPlatformRepository(pool);
  const passwordHasher = new BcryptPasswordHasher();
  const jwtTokenService = new JwtTokenService(config);
  const authService = new AuthenticationService(repository, passwordHasher, jwtTokenService, {
    maxFailedAttempts: config.AUTH_MAX_FAILED_ATTEMPTS,
    lockoutMinutes: config.AUTH_LOCKOUT_MINUTES,
  });
  const authorizationService = new AuthorizationService(repository);
  const branchService = new BranchService(repository);
  const coreEnterpriseService = new CoreEnterpriseService(repository);
  const locationService = new LocationService(repository);
  const moduleAccessService = new ModuleAccessService(pool);
  const transactionRunner = new UnitOfWork(pool);
  const registrationService = new UserRegistrationService(repository, passwordHasher, {
    minLength: config.AUTH_PASSWORD_MIN_LENGTH,
    requireUppercase: config.AUTH_PASSWORD_REQUIRE_UPPERCASE,
    requireLowercase: config.AUTH_PASSWORD_REQUIRE_LOWERCASE,
    requireNumber: config.AUTH_PASSWORD_REQUIRE_NUMBER,
    requireSymbol: config.AUTH_PASSWORD_REQUIRE_SYMBOL,
  }, transactionRunner);
  const tenantMembershipService = new TenantMembershipService(repository);

  app.decorate('appConfig', config);
  app.decorate('dbPool', pool);
  app.decorate('authService', authService);
  app.decorate('authorizationService', authorizationService);
  app.decorate('branchService', branchService);
  app.decorate('coreEnterpriseService', coreEnterpriseService);
  app.decorate('locationService', locationService);
  app.decorate('moduleAccessService', moduleAccessService);
  app.decorate('registrationService', registrationService);
  app.decorate('jwtTokenService', jwtTokenService);
  app.decorate('tenantMembershipService', tenantMembershipService);

  await app.register(cors, {
    origin: (origin, callback) => {
      callback(null, isCorsOriginAllowed(config, origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  await app.register(rateLimit, {
    global: false,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => {
      const error = new Error(`Too many requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`);
      return Object.assign(error, { code: 'RATE_LIMIT_EXCEEDED', statusCode: context.statusCode });
    },
  });

  await setupSwagger(app);

  app.setErrorHandler(buildErrorHandler(config));

  await app.register(healthRoutes, { prefix: config.API_PREFIX });
  await app.register(authRoutes, { prefix: config.API_PREFIX });
  await app.register(rbacRoutes, { prefix: config.API_PREFIX });
  await app.register(branchRoutes, { prefix: config.API_PREFIX });
  await app.register(coreEnterpriseRoutes, { prefix: config.API_PREFIX });
  await app.register(locationRoutes, { prefix: config.API_PREFIX });

  return app;
}

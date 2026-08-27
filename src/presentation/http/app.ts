import { type Pool } from 'pg';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

import { isCorsOriginAllowed, type AppConfig } from '../../config/schema.js';
import { AuthenticationService } from '../../application/services/authentication-service.js';
import { AuthorizationService } from '../../application/services/authorization-service.js';
import { CoreEnterpriseService } from '../../application/services/core-enterprise-service.js';
import { LocationService } from '../../application/services/location-service.js';
import { ModuleAccessService } from '../../application/services/module-access-service.js';
import { TenantMembershipService } from '../../application/services/tenant-membership-service.js';
import { UserRegistrationService } from '../../application/services/user-registration-service.js';
import { createDatabasePool } from '../../infrastructure/database/connection.js';
import { IdentityAwarePostgresPlatformRepository } from '../../infrastructure/database/repositories/identity-aware-postgres-platform-repository.js';
import { buildErrorHandler } from '../../infrastructure/http/error-handler.js';
import { BcryptPasswordHasher } from '../../infrastructure/security/bcrypt-password-hasher.js';
import { JwtTokenService } from '../../infrastructure/security/jwt-token-service.js';
import { createLogger } from '../../infrastructure/logging/logger.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import coreEnterpriseRoutes from './routes/core-enterprise.js';
import locationRoutes from './routes/location.js';
import rbacRoutes from './routes/rbac.js';

export async function createApplication(config: AppConfig, providedPool?: Pool): Promise<FastifyInstance> {
  const app = Fastify({
    logger: createLogger(config),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    ignoreTrailingSlash: true,
    ajv: {
      customOptions: {
        allErrors: true,
        coerceTypes: true,
        removeAdditional: false,
      },
    },
  });

  const pool = providedPool ?? createDatabasePool(config);
  const repository = new IdentityAwarePostgresPlatformRepository(pool);
  const passwordHasher = new BcryptPasswordHasher();
  const jwtTokenService = new JwtTokenService(config);
  const authService = new AuthenticationService(repository, passwordHasher, jwtTokenService);
  const authorizationService = new AuthorizationService(repository);
  const coreEnterpriseService = new CoreEnterpriseService(repository);
  const locationService = new LocationService(repository);
  const moduleAccessService = new ModuleAccessService(pool);
  const registrationService = new UserRegistrationService(repository, passwordHasher);
  const tenantMembershipService = new TenantMembershipService(repository);

  app.decorate('appConfig', config);
  app.decorate('authService', authService);
  app.decorate('authorizationService', authorizationService);
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  app.setErrorHandler(buildErrorHandler(config));

  await app.register(healthRoutes, { prefix: config.API_PREFIX });
  await app.register(authRoutes, { prefix: config.API_PREFIX });
  await app.register(rbacRoutes, { prefix: config.API_PREFIX });
  await app.register(coreEnterpriseRoutes, { prefix: config.API_PREFIX });
  await app.register(locationRoutes, { prefix: config.API_PREFIX });

  return app;
}

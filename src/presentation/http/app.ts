import { type Pool } from 'pg';
import Fastify, { type FastifyInstance } from 'fastify';

import type { AppConfig } from '../../config/schema.js';
import { AuthenticationService } from '../../application/services/authentication-service.js';
import { AuthorizationService } from '../../application/services/authorization-service.js';
import { CoreEnterpriseService } from '../../application/services/core-enterprise-service.js';
import { UserRegistrationService } from '../../application/services/user-registration-service.js';
import { createDatabasePool } from '../../infrastructure/database/connection.js';
import { PostgresPlatformRepository } from '../../infrastructure/database/repositories/postgres-platform-repository.js';
import { buildErrorHandler } from '../../infrastructure/http/error-handler.js';
import { BcryptPasswordHasher } from '../../infrastructure/security/bcrypt-password-hasher.js';
import { JwtTokenService } from '../../infrastructure/security/jwt-token-service.js';
import { createLogger } from '../../infrastructure/logging/logger.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import coreEnterpriseRoutes from './routes/core-enterprise.js';
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
  const repository = new PostgresPlatformRepository(pool);
  const passwordHasher = new BcryptPasswordHasher();
  const jwtTokenService = new JwtTokenService(config);
  const authService = new AuthenticationService(repository, passwordHasher, jwtTokenService);
  const authorizationService = new AuthorizationService(repository);
  const coreEnterpriseService = new CoreEnterpriseService(repository);
  const registrationService = new UserRegistrationService(repository, passwordHasher);

  app.decorate('appConfig', config);
  app.decorate('authService', authService);
  app.decorate('authorizationService', authorizationService);
  app.decorate('coreEnterpriseService', coreEnterpriseService);
  app.decorate('registrationService', registrationService);
  app.decorate('jwtTokenService', jwtTokenService);

  app.setErrorHandler(buildErrorHandler(config));

  await app.register(healthRoutes, { prefix: config.API_PREFIX });
  await app.register(authRoutes, { prefix: config.API_PREFIX });
  await app.register(rbacRoutes, { prefix: config.API_PREFIX });
  await app.register(coreEnterpriseRoutes, { prefix: config.API_PREFIX });

  return app;
}

import Fastify, { type FastifyInstance } from 'fastify';

import type { AppConfig } from '../../config/schema.js';
import { createLogger } from '../../infrastructure/logging/logger.js';
import { buildErrorHandler } from '../../infrastructure/http/error-handler.js';
import healthRoutes from './routes/health.js';

export async function createApplication(config: AppConfig): Promise<FastifyInstance> {
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

  app.setErrorHandler(buildErrorHandler(config));

  await app.register(healthRoutes, { prefix: config.API_PREFIX });

  return app;
}

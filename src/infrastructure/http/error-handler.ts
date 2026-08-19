import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

import type { AppConfig } from '../../config/schema.js';

export function buildErrorHandler(config: AppConfig) {
  return (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode ?? 500;
    const body = {
      error: {
        code: error.code ?? 'INTERNAL_SERVER_ERROR',
        message: error.message ?? 'Internal Server Error',
        requestId: request.id,
        timestamp: new Date().toISOString(),
        details: config.NODE_ENV === 'development' ? error : undefined,
      },
    };

    if (statusCode >= 500) {
      request.log.error({ err: error, requestId: request.id }, 'Unhandled server error');
    }

    reply.code(statusCode).send(body);
  };
}

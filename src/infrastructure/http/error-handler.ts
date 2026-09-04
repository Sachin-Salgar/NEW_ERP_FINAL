import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

import type { AppConfig } from '../../config/schema.js';

export function buildErrorHandler(config: AppConfig) {
  return (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const isValidationError = error.code === 'FST_ERR_VALIDATION';
    const statusCode = isValidationError ? 400 : error.statusCode ?? 500;
    const body = {
      error: {
        code: isValidationError ? 'VALIDATION_ERROR' : error.code ?? 'INTERNAL_SERVER_ERROR',
        message: isValidationError ? 'Request validation failed.' : error.message ?? 'Internal Server Error',
        requestId: request.id,
        timestamp: new Date().toISOString(),
        details: isValidationError
          ? error.validation?.map((issue) => ({
            field: issue.instancePath || issue.params?.missingProperty || issue.schemaPath,
            message: issue.message,
          }))
          : config.NODE_ENV === 'development' ? error : undefined,
      },
    };

    if (statusCode >= 500) {
      request.log.error({ err: error, requestId: request.id }, 'Unhandled server error');
    }

    reply.code(statusCode).send(body);
  };
}

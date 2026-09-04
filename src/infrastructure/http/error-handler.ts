import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from '../../domain/errors.js';
import type { AppConfig } from '../../config/schema.js';

function acceptsProblemJson(request: FastifyRequest): boolean {
  const accept = request.headers.accept;
  if (!accept) return false;

  return accept
    .split(',')
    .map((value) => value.split(';', 1)[0]?.trim().toLowerCase())
    .some((value) => value === 'application/problem+json');
}

export function buildErrorHandler(config: AppConfig) {
  return (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const isValidationError = error.code === 'FST_ERR_VALIDATION';
    const appError = error instanceof AppError ? error : undefined;
    const statusCode = isValidationError ? 400 : appError?.statusCode ?? error.statusCode ?? 500;
    const exposedMessage = appError?.expose === false || statusCode >= 500
      ? 'Internal Server Error'
      : error.message ?? 'Internal Server Error';
    const validationDetails = isValidationError
      ? error.validation?.map((issue) => ({
        field: issue.instancePath || issue.params?.missingProperty || issue.schemaPath,
        message: issue.message,
      }))
      : undefined;

    if (statusCode >= 500) {
      request.log.error({ err: error, requestId: request.id }, 'Unhandled server error');
    }

    if (acceptsProblemJson(request)) {
      const type = isValidationError
        ? 'https://httpstatuses.com/400'
        : `https://httpstatuses.com/${statusCode}`;
      const problem = {
        type,
        title: isValidationError ? 'Bad Request' : statusCode >= 500 ? 'Internal Server Error' : appError?.code ?? error.code ?? 'Error',
        status: statusCode,
        detail: exposedMessage,
        instance: request.url,
        errors: validationDetails ?? (appError?.details && Array.isArray(appError.details) ? appError.details : undefined),
      };

      return reply.type('application/problem+json').code(statusCode).send(problem);
    }

    const body = {
      error: {
        code: isValidationError ? 'VALIDATION_ERROR' : appError?.code ?? error.code ?? 'INTERNAL_SERVER_ERROR',
        message: exposedMessage,
        requestId: request.id,
        timestamp: new Date().toISOString(),
        details: validationDetails ?? (config.NODE_ENV === 'development' && statusCode < 500 ? appError?.details : undefined),
      },
    };

    return reply.code(statusCode).send(body);
  };
}

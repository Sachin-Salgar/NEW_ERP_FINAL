import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export function normalizeCorrelationId(value: string | undefined | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveCorrelationId(request: FastifyRequest): string {
  const explicit = normalizeCorrelationId(
    Array.isArray(request.headers['x-correlation-id'])
      ? request.headers['x-correlation-id'][0]
      : request.headers['x-correlation-id'] as string | undefined,
  );

  const requestId = normalizeCorrelationId(
    Array.isArray(request.headers['x-request-id'])
      ? request.headers['x-request-id'][0]
      : request.headers['x-request-id'] as string | undefined,
  );

  return explicit ?? requestId ?? request.id;
}

export function applyCorrelationIdHooks(app: FastifyInstance): void {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const correlationId = resolveCorrelationId(request);
    request.headers['x-correlation-id'] = correlationId;
    request.headers['x-request-id'] = correlationId;
    reply.header('x-correlation-id', correlationId);
    reply.header('x-request-id', correlationId);
  });
}

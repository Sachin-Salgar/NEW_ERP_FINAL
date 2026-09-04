import type { FastifyRequest } from 'fastify';

import type { AuditEvent } from '../../application/contracts/audit.js';
import { normalizeCorrelationId } from '../../infrastructure/http/correlation-id.js';

export async function recordSecurityEvent(
  request: FastifyRequest,
  event: Omit<AuditEvent, 'correlationId'>,
): Promise<void> {
  const rawCorrelationId = request.headers['x-correlation-id'];
  const correlationId = normalizeCorrelationId(
    Array.isArray(rawCorrelationId) ? rawCorrelationId[0] : rawCorrelationId,
  );
  await request.server.auditLogger.record({ ...event, correlationId });
}

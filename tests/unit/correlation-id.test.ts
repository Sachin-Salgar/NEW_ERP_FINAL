import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { applyCorrelationIdHooks } from '../../src/infrastructure/http/correlation-id.js';

describe('correlation id propagation', () => {
  it('echoes the supplied correlation id on responses', async () => {
    const app = Fastify({ logger: false });
    applyCorrelationIdHooks(app);

    app.get('/health', async () => ({ ok: true }));
    await app.ready();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-correlation-id': 'corr-123' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-correlation-id']).toBe('corr-123');
      expect(response.headers['x-request-id']).toBe('corr-123');
    } finally {
      await app.close();
    }
  });

  it('generates a correlation id when none is provided', async () => {
    const app = Fastify({ logger: false });
    applyCorrelationIdHooks(app);

    app.get('/health', async () => ({ ok: true }));
    await app.ready();

    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['x-correlation-id']).toBeTruthy();
      expect(response.headers['x-request-id']).toBe(response.headers['x-correlation-id']);
    } finally {
      await app.close();
    }
  });
});

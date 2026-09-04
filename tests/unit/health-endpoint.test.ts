import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import healthRoutes from '../../src/presentation/http/routes/health.js';

describe('health endpoints', () => {
  it('reports database and memory details for healthy services', async () => {
    const app = Fastify({ logger: false });
    app.decorate('dbPool', {
      query: async () => ({ rows: [{ ok: 1 }] }),
      totalCount: 2,
      idleCount: 1,
      waitingCount: 0,
    } as any);

    await app.register(healthRoutes, { prefix: '/api/v1' });
    await app.ready();

    try {
      const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(response.statusCode).toBe(200);

      const payload = response.json();
      expect(payload.status).toBe('ok');
      expect(payload.database.connected).toBe(true);
      expect(payload.database.pool.total).toBe(2);
      expect(payload.memory.heapUsed).toBeGreaterThan(0);
      expect(payload.uptime).toBeGreaterThanOrEqual(0);
    } finally {
      await app.close();
    }
  });

  it('returns readiness failure when the database is not reachable', async () => {
    const app = Fastify({ logger: false });
    app.decorate('dbPool', {
      query: async () => {
        throw new Error('database unavailable');
      },
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
    } as any);

    await app.register(healthRoutes, { prefix: '/api/v1' });
    await app.ready();

    try {
      const response = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });
      expect(response.statusCode).toBe(503);

      const payload = response.json();
      expect(payload.status).toBe('not-ready');
      expect(payload.database.connected).toBe(false);
    } finally {
      await app.close();
    }
  });
});

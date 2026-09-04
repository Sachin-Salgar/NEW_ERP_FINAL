import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { describe, expect, it } from 'vitest';

async function buildRateLimitedApp() {
  const app = Fastify({ logger: false });
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => {
      const error = new Error('Too many requests.');
      return Object.assign(error, { code: 'RATE_LIMIT_EXCEEDED', statusCode: context.statusCode });
    },
  });

  app.post('/auth/login', {
    config: { rateLimit: { max: 2, timeWindow: 60_000 } },
  }, async () => ({ success: true }));
  app.get('/health', async () => ({ status: 'ok' }));
  await app.ready();
  return app;
}

describe('authentication rate limiting', () => {
  it('rejects requests beyond the configured limit and returns Retry-After', async () => {
    const app = await buildRateLimitedApp();
    try {
      expect((await app.inject({ method: 'POST', url: '/auth/login' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: '/auth/login' })).statusCode).toBe(200);
      const limited = await app.inject({ method: 'POST', url: '/auth/login' });
      expect(limited.statusCode).toBe(429);
      expect(limited.headers['retry-after']).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it('does not throttle unrelated endpoints', async () => {
    const app = await buildRateLimitedApp();
    try {
      for (let index = 0; index < 3; index += 1) {
        expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
      }
    } finally {
      await app.close();
    }
  });
});

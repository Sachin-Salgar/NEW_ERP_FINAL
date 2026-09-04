import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

describe('request size limits', () => {
  it('rejects oversized request bodies before the handler runs', async () => {
    const app = Fastify({ logger: false, bodyLimit: 64 });

    app.post('/auth/login', { bodyLimit: 16 }, async () => ({ success: true }));

    await app.ready();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ message: 'x'.repeat(128) }),
      });

      expect(response.statusCode).toBe(413);
    } finally {
      await app.close();
    }
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { closeIntegrationPool } from '../helpers/database.js';
import { createTestApp, createTestPool } from '../helpers/test-app.js';

describe('API versioning contract', () => {
  let pool: Pool;
  let app: FastifyInstance;

  beforeAll(async () => {
    pool = createTestPool();
    app = await createTestApp(pool);
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeIntegrationPool(pool);
  });

  it('advertises the path-based API version on versioned responses', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health/live' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-api-version']).toBe('v1');
    expect(response.headers['x-api-version-policy']).toBe('path');
  });
});

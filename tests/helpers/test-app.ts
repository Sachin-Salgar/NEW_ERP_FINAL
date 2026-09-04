import { Pool } from 'pg';

import { parseAppConfig, resolveDatabaseUrl } from '../../src/config/schema.js';
import { createApplication } from '../../src/presentation/http/app.js';

export function createTestPool(): Pool {
  const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL is required for integration tests.');
  }

  return new Pool({ connectionString: databaseUrl });
}

export async function createTestApp(pool: Pool) {
  const config = parseAppConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
    DATABASE_SSL_MODE: process.env.DATABASE_SSL_MODE ?? 'disable',
    JWT_SECRET: process.env.JWT_SECRET ?? 'test-only-jwt-secret-change-me-123456789',
  });

  return createApplication(config, pool);
}

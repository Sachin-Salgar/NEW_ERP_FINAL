import { type Pool } from 'pg';

import { parseAppConfig } from '../../src/config/schema.js';
import { createApplication } from '../../src/presentation/http/app.js';
import { createIntegrationPool } from './database.js';

export function createTestPool(): Pool {
  return createIntegrationPool();
}

export async function createTestApp(pool: Pool) {
  const config = parseAppConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
    DATABASE_SSL_MODE: process.env.DATABASE_SSL_MODE ?? 'disable',
    JWT_SECRET: process.env.JWT_SECRET ?? 'test-only-jwt-secret-change-me-123456789',
    MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY ?? 'test-only-mfa-encryption-key-change-me-123456',
  });

  return createApplication(config, pool);
}

import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { beforeAll } from 'vitest';
import { Pool } from 'pg';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { runMigrations } from '../../src/infrastructure/database/migrate.js';
import { resolveIntegrationAdminDatabaseUrl } from './database.js';
import { runPlatformSecurityBootstrap } from '../../src/infrastructure/database/platform-security.js';

dotenv.config({ path: '.env.local', override: true });

beforeAll(async () => {
  if (process.env.SKIP_INTEGRATION_MIGRATIONS === 'true') return;
  const testUrl = resolveDatabaseUrl(process.env, { forTest: true });
  const targetAdminUrl = resolveIntegrationAdminDatabaseUrl();
  const setupRole = new URL(testUrl).username;
  const password = process.env.ADR0040_SECURITY_ROLE_PASSWORD ?? randomBytes(24).toString('base64url');
  process.env.ADR0040_SECURITY_ROLE_PASSWORD = password;
  await runMigrations(targetAdminUrl, 'disable');

  const pool = new Pool({ connectionString: targetAdminUrl, ssl: false });
  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock(hashtext('new-erp-final:integration-role-setup'))`);
    await runPlatformSecurityBootstrap(client);
    if (setupRole !== 'postgres') {
      const quotedRole = setupRole.replaceAll('"', '""');
      await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${quotedRole}"`);
      await client.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${quotedRole}"`);
    }
    await client.query(`SELECT pg_advisory_unlock(hashtext('new-erp-final:integration-role-setup'))`);
  } finally {
    client.release();
    await pool.end();
  }


  process.env.INTEGRATION_APPLICATION_DATABASE_URL = testUrl;
});

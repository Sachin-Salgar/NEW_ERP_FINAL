import dotenv from 'dotenv';
import fs from 'node:fs';
import { beforeAll } from 'vitest';
import { Pool } from 'pg';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { runMigrations } from '../../src/infrastructure/database/migrate.js';
import { resolveIntegrationAdminDatabaseUrl } from './database.js';

dotenv.config({ path: '.env.local' });

beforeAll(async () => {
  if (process.env.SKIP_INTEGRATION_MIGRATIONS === 'true') return;
  const testUrl = resolveDatabaseUrl(process.env, { forTest: true });
  const targetAdminUrl = resolveIntegrationAdminDatabaseUrl();
  const setupRole = new URL(testUrl).username;
  await runMigrations(targetAdminUrl, 'disable');

  const pool = new Pool({ connectionString: targetAdminUrl, ssl: false });
  const password = process.env.ADR0040_SECURITY_ROLE_PASSWORD ?? 'integration-role-password-2026!';
  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock(hashtext('new-erp-final:integration-role-setup'))`);
    await client.query(fs.readFileSync('scripts/platform-security.sql', 'utf8'));
    for (const role of ['erp_app', 'erp_platform_executor', 'erp_procedure_owner']) {
      await client.query(`ALTER ROLE "${role}" LOGIN PASSWORD '${password.replaceAll("'", "''")}'`);
    }
    await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app');
    await client.query('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO erp_app');
    if (setupRole !== 'postgres' && setupRole !== 'erp_app') {
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${setupRole.replaceAll('"', '""')}"`,
      );
      await client.query(
        `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${setupRole.replaceAll('"', '""')}"`,
      );
    }
    await client.query(`SELECT pg_advisory_unlock(hashtext('new-erp-final:integration-role-setup'))`);
  } finally {
    client.release();
    await pool.end();
  }

  process.env.INTEGRATION_APPLICATION_DATABASE_URL = (() => {
    const app = new URL(testUrl);
    app.username = 'erp_app';
    app.password = password;
    return app.toString();
  })();
});


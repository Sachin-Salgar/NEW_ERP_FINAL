import { Pool } from 'pg';

import { resolveDatabaseUrl } from '../../src/config/schema.js';

export function resolveIntegrationAdminDatabaseUrl(): string {
  const testUrl = new URL(resolveDatabaseUrl(process.env, { forTest: true }));
  const configuredAdminUrl = process.env.INTEGRATION_ADMIN_DATABASE_URL?.trim();
  const adminUrl = configuredAdminUrl
    ? new URL(configuredAdminUrl)
    : process.env.PGUSER && process.env.PGPASSWORD
      ? new URL(
          `postgresql://${encodeURIComponent(process.env.PGUSER)}:${encodeURIComponent(process.env.PGPASSWORD)}@${process.env.PGHOST ?? 'localhost'}:${process.env.PGPORT ?? '5432'}/postgres`,
        )
      : new URL(resolveDatabaseUrl(process.env));
  adminUrl.pathname = testUrl.pathname;
  return adminUrl.toString();
}

export function resolveIntegrationApplicationDatabaseUrl(): string {
  const configured = process.env.INTEGRATION_APPLICATION_DATABASE_URL;
  if (!configured) {
    throw new Error('Integration application database URL was not initialized by tests/integration/setup.ts.');
  }
  return configured;
}

export function createIntegrationAdminPool(): Pool {
  return new Pool({ connectionString: resolveIntegrationAdminDatabaseUrl(), ssl: false });
}

export function createIntegrationApplicationPool(): Pool {
  return new Pool({ connectionString: resolveIntegrationApplicationDatabaseUrl(), ssl: false });
}

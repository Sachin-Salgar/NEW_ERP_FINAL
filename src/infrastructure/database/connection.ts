import { Pool, type PoolClient } from 'pg';

import type { AppConfig } from '../../config/schema.js';

export type DatabasePool = Pool;

export type DatabaseSslMode = 'disable' | 'require';

/**
 * Map the application's PostgreSQL SSL policy to node-postgres TLS options.
 *
 * PostgreSQL's sslmode=require means TLS is required but certificate
 * verification is not required. Render's internal PostgreSQL endpoint uses
 * self-signed certificates, so rejectUnauthorized=true is incompatible with
 * the supported Render internal connection mode.
 *
 * DATABASE_SSL_CA is retained in configuration for compatibility/future
 * verification modes, but is intentionally not applied to require.
 */
export function getDatabaseSslOptions(
  sslMode: DatabaseSslMode,
  _certificateAuthority?: string,
): { rejectUnauthorized: false } | undefined {
  if (sslMode === 'disable') return undefined;
  return { rejectUnauthorized: false };
}

export function createDatabasePoolFromUrl(
  databaseUrl: string,
  options: {
    min?: number;
    max?: number;
    applicationName?: string;
    sslMode?: DatabaseSslMode;
    certificateAuthority?: string;
  } = {},
): Pool {
  return new Pool({
    connectionString: databaseUrl,
    min: options.min,
    max: options.max,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 30000,
    application_name: options.applicationName,
    ssl: getDatabaseSslOptions(options.sslMode ?? 'require', options.certificateAuthority),
  });
}

export function createDatabasePool(config: AppConfig): Pool {
  return createDatabasePoolFromUrl(config.DATABASE_URL, {
    min: config.DATABASE_POOL_MIN,
    max: config.DATABASE_POOL_MAX,
    applicationName: config.APP_NAME,
    sslMode: config.DATABASE_SSL_MODE,
    certificateAuthority: config.DATABASE_SSL_CA,
  });
}

export function createDatabaseClientOptions(
  databaseUrl: string,
  sslMode: DatabaseSslMode = 'require',
  certificateAuthority?: string,
) {
  return {
    connectionString: databaseUrl,
    ssl: getDatabaseSslOptions(sslMode, certificateAuthority),
  };
}

export async function pingDatabase(pool: Pool): Promise<void> {
  const result = await pool.query('SELECT 1 AS ok');

  if (result.rows.length !== 1 || result.rows[0]?.ok !== 1) {
    throw new Error('Database health check failed.');
  }
}

export async function closeDatabasePool(pool: Pool): Promise<void> {
  await pool.end();
}

export async function withDatabaseClient<T>(pool: Pool, callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}
import { Pool, type PoolClient } from 'pg';

import type { AppConfig } from '../../config/schema.js';

export type DatabasePool = Pool;

export type DatabaseSslMode = 'disable' | 'require';

export function getDatabaseSslOptions(sslMode: DatabaseSslMode): { rejectUnauthorized: true } | undefined {
  return sslMode === 'require' ? { rejectUnauthorized: true } : undefined;
}

export function createDatabasePoolFromUrl(
  databaseUrl: string,
  options: { min?: number; max?: number; applicationName?: string; sslMode?: DatabaseSslMode } = {},
): Pool {
  return new Pool({
    connectionString: databaseUrl,
    min: options.min,
    max: options.max,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 30000,
    application_name: options.applicationName,
    ssl: getDatabaseSslOptions(options.sslMode ?? 'require'),
  });
}

export function createDatabasePool(config: AppConfig): Pool {
  return createDatabasePoolFromUrl(config.DATABASE_URL, {
    min: config.DATABASE_POOL_MIN,
    max: config.DATABASE_POOL_MAX,
    applicationName: config.APP_NAME,
    sslMode: config.DATABASE_SSL_MODE,
  });
}

export function createDatabaseClientOptions(databaseUrl: string, sslMode: DatabaseSslMode = 'require') {
  return {
    connectionString: databaseUrl,
    ssl: getDatabaseSslOptions(sslMode),
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

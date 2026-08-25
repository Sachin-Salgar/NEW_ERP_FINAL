import { Pool, type PoolClient } from 'pg';

import type { AppConfig } from '../../config/schema.js';

export type DatabasePool = Pool;

export function createDatabasePool(config: AppConfig): Pool {
  return new Pool({
    connectionString: config.DATABASE_URL,
    min: config.DATABASE_POOL_MIN,
    max: config.DATABASE_POOL_MAX,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 30000,
    application_name: config.APP_NAME,
  });
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

import { Pool, type PoolClient } from 'pg';

import { resolveDatabaseUrl } from '../../src/config/schema.js';

export function resolveTestDatabaseUrl(): string {
  const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL is required for integration tests.');
  }
  return databaseUrl;
}

export function createIntegrationPool(): Pool {
  const applicationUrl = process.env.INTEGRATION_APPLICATION_DATABASE_URL;
  if (!applicationUrl) {
    throw new Error('Integration application database URL was not initialized by tests/integration/setup.ts.');
  }
  return new Pool({ connectionString: applicationUrl, ssl: false });
}

export async function withIntegrationClient<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await operation(client);
  } finally {
    client.release();
  }
}

export async function withRollbackTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withIntegrationClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      return await operation(client);
    } finally {
      await client.query('ROLLBACK');
    }
  });
}

export async function closeIntegrationPool(pool: Pool | undefined): Promise<void> {
  if (pool) await pool.end();
}


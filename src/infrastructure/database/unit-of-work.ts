import type { Pool, PoolClient } from 'pg';

/**
 * Explicit PostgreSQL transaction boundary for application/service orchestration.
 *
 * Tenant/RLS context must be established on the same client before repository
 * work is executed. This class deliberately does not create or clear tenant
 * context itself; callers that require RLS should use the tenant-context
 * boundary with the transaction client rather than moving context to a pool
 * connection.
 */
export class UnitOfWork {
  private client: PoolClient | undefined;
  private completed = false;

  constructor(private readonly pool: Pool) {}

  async begin(): Promise<PoolClient> {
    if (this.client) {
      throw new Error('UnitOfWork transaction has already begun.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      this.client = client;
      return client;
    } catch (error) {
      client.release();
      throw error;
    }
  }

  getClient(): PoolClient {
    if (!this.client || this.completed) {
      throw new Error('UnitOfWork has no active transaction.');
    }

    return this.client;
  }

  async commit(): Promise<void> {
    const client = this.getClient();

    try {
      await client.query('COMMIT');
      this.completed = true;
    } finally {
      client.release();
      this.client = undefined;
    }
  }

  async rollback(): Promise<void> {
    if (!this.client || this.completed) {
      return;
    }

    const client = this.client;
    try {
      await client.query('ROLLBACK');
    } finally {
      this.completed = true;
      this.client = undefined;
      client.release();
    }
  }

  async runInTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.begin();

    try {
      const result = await callback(client);
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}

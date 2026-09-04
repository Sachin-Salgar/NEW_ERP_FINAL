import type { Pool, PoolClient } from 'pg';

import { runInTransactionContext } from './transaction-context.js';

/**
 * Explicit PostgreSQL transaction boundary for application/service orchestration.
 *
 * Repository tenant context can safely reuse the same client through the
 * transaction async context. This prevents nested BEGIN/COMMIT transactions
 * when a service owns the transaction boundary.
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
      this.completed = false;
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
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original COMMIT failure; the connection is still released below.
      }
      this.completed = true;
      throw error;
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

  async runInTransaction<T>(callback: () => Promise<T>): Promise<T> {
    const client = await this.begin();

    try {
      return await runInTransactionContext(client, async () => {
        const result = await callback();
        await this.commit();
        return result;
      });
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}

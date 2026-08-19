import { validate as isUuid } from 'uuid';
import type { Pool, PoolClient } from 'pg';

import type { TenantContextProvider } from '../../domain/contracts/tenant-context.js';
import { TenantContextError } from '../../domain/errors.js';

export class PostgresTenantContextProvider implements TenantContextProvider {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey: string,
  ) {}

  async getCurrentTenantId(): Promise<string | undefined> {
    const result = await this.pool.query('SELECT current_setting($1, true) AS tenant_id', [this.tenantContextKey]);
    const tenantId = result.rows[0]?.tenant_id as string | undefined;
    return tenantId || undefined;
  }

  async setTenantContext(tenantId: string): Promise<void> {
    if (!isUuid(tenantId)) {
      throw new TenantContextError(`The tenant identifier is not a valid UUID: ${tenantId}`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const safeKey = this.tenantContextKey.replace(/"/g, '""');
      await client.query(`SET LOCAL "${safeKey}" = '${tenantId.replace(/'/g, "''")}'`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async withTenantContext<T>(tenantId: string, callback: (client: PoolClient) => Promise<T>): Promise<T> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, callback);
  }

  async clearTenantContext(): Promise<void> {
    const safeKey = this.tenantContextKey.replace(/"/g, '""');
    await this.pool.query(`RESET "${safeKey}"`);
  }
}

export async function withTenantContext<T>(pool: Pool, tenantContextKey: string, tenantId: string, callback: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!isUuid(tenantId)) {
    throw new TenantContextError(`The tenant identifier is not a valid UUID: ${tenantId}`);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const safeKey = tenantContextKey.replace(/"/g, '""');
    await client.query(`SET LOCAL "${safeKey}" = '${tenantId.replace(/'/g, "''")}'`);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

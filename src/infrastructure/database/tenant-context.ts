import { validate as isUuid } from 'uuid';
import type { Pool, PoolClient } from 'pg';

import type { TenantContext, TenantContextProvider } from '../../domain/contracts/tenant-context.js';
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

  async getCurrentTenantContext(): Promise<TenantContext | undefined> {
    const tenantId = await this.getCurrentTenantId();
    if (!tenantId) {
      return undefined;
    }

    return { tenantId };
  }

  async setTenantContext(tenantId: string, context?: Partial<TenantContext>): Promise<void> {
    if (!isUuid(tenantId)) {
      throw new TenantContextError(`The tenant identifier is not a valid UUID: ${tenantId}`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const safeKey = this.tenantContextKey.replace(/"/g, '""');
      await client.query(`SET LOCAL "${safeKey}" = '${tenantId.replace(/'/g, "''")}'`);
      if (context) {
        await client.query(`SELECT set_config('${this.tenantContextKey}_context', '${JSON.stringify(context).replace(/'/g, "''")}', true)`);
        const contextEntries: Array<[string, string | null]> = [
          [`${this.tenantContextKey}_user_id`, context.userId ?? null],
          [`${this.tenantContextKey}_organization_id`, context.organizationId ?? context.activeOrganizationId ?? null],
          [`${this.tenantContextKey}_location_id`, context.activeLocationId ?? context.locationAccess?.[0] ?? null],
        ];
        for (const [settingKey, rawValue] of contextEntries) {
          if (rawValue === null || rawValue === undefined || rawValue.trim() === '') {
            await client.query(`SELECT set_config('${settingKey}', NULL, true)`);
            continue;
          }
          await client.query(`SELECT set_config('${settingKey}', '${String(rawValue).replace(/'/g, "''")}', true)`);
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async withTenantContext<T>(tenantId: string, callback: (client: PoolClient) => Promise<T>, context?: Partial<TenantContext>): Promise<T> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, callback, context);
  }

  async clearTenantContext(): Promise<void> {
    const safeKey = this.tenantContextKey.replace(/"/g, '""');
    await this.pool.query(`RESET "${safeKey}"`);
  }
}

export async function clearTenantContextSettings(pool: Pool, tenantContextKey: string): Promise<void> {
  const client = await pool.connect();
  try {
    await clearTenantContextSettingsForClient(client, tenantContextKey);
  } finally {
    client.release();
  }
}

export async function clearTenantContextSettingsForClient(client: PoolClient, tenantContextKey: string): Promise<void> {
  for (const settingKey of [
    tenantContextKey,
    `${tenantContextKey}_context`,
    `${tenantContextKey}_user_id`,
    `${tenantContextKey}_organization_id`,
    `${tenantContextKey}_location_id`,
  ]) {
    const safeSettingKey = settingKey.replace(/"/g, '""');
    await client.query(`RESET "${safeSettingKey}"`).catch(() => undefined);
  }
}

export async function withTenantContext<T>(pool: Pool, tenantContextKey: string, tenantId: string, callback: (client: PoolClient) => Promise<T>, context?: Partial<TenantContext>): Promise<T> {
  if (!isUuid(tenantId)) {
    throw new TenantContextError(`The tenant identifier is not a valid UUID: ${tenantId}`);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const safeKey = tenantContextKey.replace(/"/g, '""');
    await client.query(`SET LOCAL "${safeKey}" = '${tenantId.replace(/'/g, "''")}'`);
    if (context) {
      await client.query(`SELECT set_config('${tenantContextKey}_context', '${JSON.stringify(context).replace(/'/g, "''")}', true)`);
      const contextEntries: Array<[string, string | null]> = [
        [`${tenantContextKey}_user_id`, context.userId ?? null],
        [`${tenantContextKey}_organization_id`, context.organizationId ?? context.activeOrganizationId ?? null],
        [`${tenantContextKey}_location_id`, context.activeLocationId ?? context.locationAccess?.[0] ?? null],
      ];
      for (const [settingKey, rawValue] of contextEntries) {
        if (rawValue === null || rawValue === undefined || rawValue.trim() === '') {
          await client.query(`SELECT set_config('${settingKey}', NULL, true)`);
          continue;
        }
        await client.query(`SELECT set_config('${settingKey}', '${String(rawValue).replace(/'/g, "''")}', true)`);
      }
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await clearTenantContextSettingsForClient(client, tenantContextKey).catch(() => undefined);
    client.release();
  }
}

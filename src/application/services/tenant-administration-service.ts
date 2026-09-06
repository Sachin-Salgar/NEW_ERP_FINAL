import type { Pool } from 'pg';
import { ValidationError } from '../../domain/errors.js';
import { withTenantContext } from '../../infrastructure/database/tenant-context.js';

export class TenantAdministrationService {
  constructor(private readonly pool: Pool, private readonly tenantContextKey = 'app.current_tenant_id') {}

  async get(tenantId: string) {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, (client) =>
      client.query(`SELECT id, name, display_name as "displayName", subdomain, slug, timezone, currency, locale, status,
                           created_at as "createdAt", updated_at as "updatedAt", is_deleted as "isDeleted"
                    FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]),
    );
    return result.rows[0] ?? null;
  }

  async update(tenantId: string, changes: { name?: string; displayName?: string | null; timezone?: string; currency?: string; locale?: string }) {
    const fields: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    for (const [column, value] of Object.entries(changes)) {
      if (value === undefined) continue;
      fields.push(`${column === 'displayName' ? 'display_name' : column} = $${values.length + 1}`);
      values.push(value);
    }
    if (values.length === 0) throw new ValidationError('At least one tenant field is required.');
    values.push(tenantId);
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, (client) =>
      client.query(`UPDATE tenants SET ${fields.join(', ')} WHERE id = $${values.length} AND is_deleted = false RETURNING id, name, display_name as "displayName", subdomain, slug, timezone, currency, locale, status, is_deleted as "isDeleted"`, values),
    );
    return result.rows[0] ?? null;
  }

  async transition(tenantId: string, status: 'active' | 'suspended' | 'cancelled') {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, (client) =>
      client.query(
        `UPDATE tenants SET status = $2, is_deleted = CASE WHEN $2 = 'cancelled' THEN true ELSE false END,
         deleted_at = CASE WHEN $2 = 'cancelled' THEN NOW() ELSE NULL END, updated_at = NOW()
         WHERE id = $1 AND is_deleted = false RETURNING id, status, is_deleted as "isDeleted"`,
        [tenantId, status],
      ),
    );
    return result.rows[0] ?? null;
  }
}

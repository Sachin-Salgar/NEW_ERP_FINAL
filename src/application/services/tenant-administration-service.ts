import type { Pool } from 'pg';
import { ValidationError } from '../../domain/errors.js';
import { withTenantContext } from '../../infrastructure/database/tenant-context.js';

export class TenantAdministrationService {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey = 'app.current_tenant_id',
  ) {}

  async get(tenantId: string) {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, (client) =>
      client.query(
        `SELECT id, name, display_name as "displayName", subdomain, slug, timezone, currency, locale, status,
                           created_at as "createdAt", updated_at as "updatedAt", is_deleted as "isDeleted"
                    FROM tenants WHERE id = $1 LIMIT 1`,
        [tenantId],
      ),
    );
    return result?.rows?.[0] ?? null;
  }

  async update(
    tenantId: string,
    changes: { name?: string; displayName?: string | null; timezone?: string; currency?: string; locale?: string },
  ) {
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
      client.query(
        `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${values.length} AND is_deleted = false RETURNING id, name, display_name as "displayName", subdomain, slug, timezone, currency, locale, status, is_deleted as "isDeleted"`,
        values,
      ),
    );
    return result?.rows?.[0] ?? null;
  }

  async transition(tenantId: string, action: 'suspend' | 'reactivate' | 'deactivate' | 'activate') {
    const result = await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const current = await client.query(
        `SELECT id, status, is_deleted as "isDeleted" FROM tenants WHERE id = $1 LIMIT 1`,
        [tenantId],
      );
      const tenant = current.rows[0];
      if (!tenant) return null;
      const transitions: Record<string, string[]> = {
        suspend: ['active', 'trial', 'maintenance'],
        reactivate: ['suspended'],
        deactivate: ['active', 'trial', 'maintenance', 'suspended'],
        activate: ['cancelled'],
      };
      if (tenant.isDeleted && action !== 'activate')
        throw new ValidationError('Deleted tenants cannot change lifecycle state.');
      if (!transitions[action]?.includes(tenant.status)) {
        throw new ValidationError(`Invalid tenant lifecycle transition: ${tenant.status} -> ${action}.`);
      }
      const status = action === 'deactivate' ? 'cancelled' : action === 'suspend' ? 'suspended' : 'active';
      return client.query(
        `UPDATE tenants SET status = $2::tenant_status_enum,
         is_deleted = ($2::tenant_status_enum = 'cancelled'::tenant_status_enum),
         deleted_at = CASE WHEN $2::tenant_status_enum = 'cancelled'::tenant_status_enum THEN NOW() ELSE NULL END,
         updated_at = NOW()
         WHERE id = $1 RETURNING id, status, is_deleted as "isDeleted"`,
        [tenantId, status],
      );
    });
    return result?.rows?.[0] ?? null;
  }

  async delete(tenantId: string) {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const protectedData = await client.query(
        `SELECT
           (SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND is_deleted = false) AS users,
           (SELECT COUNT(*) FROM organizations WHERE tenant_id = $1 AND is_deleted = false) AS organizations,
           (SELECT COUNT(*) FROM branches WHERE tenant_id = $1 AND is_deleted = false) AS branches,
           (SELECT COUNT(*) FROM audit_events WHERE tenant_id = $1) AS audit_events`,
        [tenantId],
      );
      const counts = protectedData.rows[0];
      if (
        Number(counts.users) > 0 ||
        Number(counts.organizations) > 0 ||
        Number(counts.branches) > 0 ||
        Number(counts.audit_events) > 0
      ) {
        throw new ValidationError('Tenant deletion is blocked while tenant data or audit history exists.');
      }
      const result = await client.query(
        `UPDATE tenants SET status = 'cancelled', is_deleted = true, deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND is_deleted = false RETURNING id, status, is_deleted as "isDeleted"`,
        [tenantId],
      );
      return result.rows[0] ?? null;
    });
  }
}

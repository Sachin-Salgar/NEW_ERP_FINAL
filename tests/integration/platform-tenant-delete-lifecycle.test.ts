import { afterAll, describe, expect, it } from 'vitest';
import { v7 as uuidV7 } from 'uuid';

import { createIntegrationAdminPool } from './database.js';

const pool = createIntegrationAdminPool();

describe('platform tenant delete lifecycle procedure', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('soft-deletes an eligible tenant using the canonical cancelled lifecycle state', async () => {
    const tenantId = uuidV7();
    const suffix = `${Date.now()}-${tenantId}`;

    try {
      await pool.query(
        `INSERT INTO tenants (id, name, subdomain, slug, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [tenantId, `Delete lifecycle ${suffix}`, `delete-${suffix}`, `delete-${suffix}`],
      );

      await pool.query('SELECT platform_delete_tenant($1::uuid)', [tenantId]);

      const result = await pool.query(
        `SELECT status, is_deleted AS "isDeleted", deleted_at AS "deletedAt"
         FROM tenants WHERE id = $1`,
        [tenantId],
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toMatchObject({ status: 'cancelled', isDeleted: true });
      expect(result.rows[0].deletedAt).toBeInstanceOf(Date);
    } finally {
      await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    }
  });

  it('blocks tenant deletion while audit history remains', async () => {
    const tenantId = uuidV7();
    const suffix = `${Date.now()}-${tenantId}`;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO tenants (id, name, subdomain, slug, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [tenantId, `Protected delete ${suffix}`, `protected-${suffix}`, `protected-${suffix}`],
      );
      await client.query(
        `INSERT INTO audit_events (tenant_id, action, resource_type, outcome)
         VALUES ($1, 'tenant.lifecycle.test', 'tenant', 'success')`,
        [tenantId],
      );

      await expect(client.query('SELECT platform_delete_tenant($1::uuid)', [tenantId])).rejects.toThrow(
        'Tenant deletion is blocked while tenant data or audit history exists.',
      );

      const result = await client.query(
        `SELECT status, is_deleted AS "isDeleted", deleted_at AS "deletedAt"
         FROM tenants WHERE id = $1`,
        [tenantId],
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toMatchObject({ status: 'active', isDeleted: false, deletedAt: null });
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  });
});

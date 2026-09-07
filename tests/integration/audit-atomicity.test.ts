import dotenv from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { PostgresAuditLogger } from '../../src/infrastructure/audit/postgres-audit-logger.js';
import { UnitOfWork } from '../../src/infrastructure/database/unit-of-work.js';
import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { v7 as uuidV7 } from 'uuid';
import { createIntegrationApplicationPool } from './database.js';

dotenv.config({ path: '.env.local' });

describe('security mutation audit atomicity', () => {
  let pool: Pool;
  let tenantId: string;
  let originalName: string;

  beforeAll(async () => {
    pool = createIntegrationApplicationPool();
    const fixtureTenantId = uuidV7();
    await pool.query(
      `INSERT INTO tenants (id, name, subdomain, slug, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [
        fixtureTenantId,
        `Audit Atomicity Tenant ${fixtureTenantId}`,
        `audit-${fixtureTenantId}`,
        `audit-${fixtureTenantId}`,
      ],
    );
    const result = await pool.query<{ id: string; name: string }>(
      'SELECT id, name FROM tenants WHERE id = $1 AND is_deleted = false',
      [fixtureTenantId],
    );
    if (result.rowCount !== 1) {
      throw new Error('Audit atomicity verification requires one tenant');
    }
    tenantId = result.rows[0].id;
    originalName = result.rows[0].name;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rolls back the protected mutation when the required audit insert fails', async () => {
    const unitOfWork = new UnitOfWork(pool);
    const audit = new PostgresAuditLogger(pool, {
      tenantContextKey: 'app.current_tenant_id',
    });
    const invalidTenantId = '00000000-0000-0000-0000-000000000000';

    await expect(
      unitOfWork.runInTransaction(async () => {
        await unitOfWork
          .getClient()
          .query('UPDATE tenants SET name = $1, updated_at = clock_timestamp() WHERE id = $2', [
            `${originalName} (audit rollback)`,
            tenantId,
          ]);
        await audit.record(
          {
            tenantId: invalidTenantId,
            action: 'tenant.lifecycle.updated',
            resourceType: 'tenant',
            resourceId: tenantId,
            outcome: 'success',
          },
          { requireTransaction: true },
        );
      }),
    ).rejects.toThrow();

    const row = await pool.query<{ name: string }>('SELECT name FROM tenants WHERE id = $1', [tenantId]);
    expect(row.rows[0].name).toBe(originalName);
  });
});

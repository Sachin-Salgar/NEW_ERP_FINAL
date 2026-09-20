import dotenv from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { PostgresAuditLogger } from '../../src/infrastructure/audit/postgres-audit-logger.js';
import { PostgresAuditRepository } from '../../src/infrastructure/database/repositories/postgres-audit-repository.js';
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

  it('retrieves only the current tenant events with filters and deterministic pagination', async () => {
    const audit = new PostgresAuditLogger(pool, {
      tenantContextKey: 'app.current_tenant_id',
    });
    const repository = new PostgresAuditRepository(pool, 'app.current_tenant_id');
    const otherTenantId = uuidV7();

    await pool.query(
      `INSERT INTO tenants (id, name, subdomain, slug, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [otherTenantId, `Other Audit Tenant ${otherTenantId}`, `other-${otherTenantId}`, `other-${otherTenantId}`],
    );

    await audit.record({
      tenantId,
      action: 'audit.query.fixture',
      resourceType: 'audit_test',
      resourceId: 'first',
      outcome: 'success',
    });
    await audit.record({
      tenantId,
      action: 'audit.query.fixture',
      resourceType: 'audit_test',
      resourceId: 'second',
      outcome: 'success',
    });
    await expect(
      audit.record({
        tenantId: '00000000-0000-0000-0000-000000000000',
        action: 'audit.query.other',
        resourceType: 'audit_test',
        resourceId: 'other',
        outcome: 'success',
      }),
    ).rejects.toThrow();
    await audit.record({
      tenantId: otherTenantId,
      action: 'audit.query.other',
      resourceType: 'audit_test',
      resourceId: 'other',
      outcome: 'success',
    });

    const firstPage = await repository.list(tenantId, {
      page: 1,
      pageSize: 1,
      order: 'desc',
      action: 'audit.query.fixture',
    });
    const secondPage = await repository.list(tenantId, {
      page: 2,
      pageSize: 1,
      order: 'desc',
      action: 'audit.query.fixture',
    });
    const allTenantEvents = await repository.list(tenantId, {
      page: 1,
      pageSize: 20,
      order: 'desc',
    });
    const otherTenant = await repository.list(otherTenantId, {
      page: 1,
      pageSize: 20,
      order: 'desc',
    });

    expect(firstPage.total).toBe(2);
    expect(firstPage.items).toHaveLength(1);
    expect(secondPage.items).toHaveLength(1);
    expect(firstPage.items[0]?.id).not.toBe(secondPage.items[0]?.id);
    expect(allTenantEvents.items.every((item) => item.tenantId === tenantId)).toBe(true);
    expect(otherTenant.items.every((item) => item.tenantId === otherTenantId)).toBe(true);
  });
});

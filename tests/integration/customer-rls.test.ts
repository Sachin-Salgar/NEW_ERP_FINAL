import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 as uuidV7 } from 'uuid';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { PostgresCustomerRepository } from '../../src/infrastructure/database/repositories/postgres-customer-repository.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';
import { UnitOfWork } from '../../src/infrastructure/database/unit-of-work.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = databaseUrl ? it : it.skip;

describe('Customer PostgreSQL tenant isolation', () => {
  let pool: Pool | undefined;
  const tenantA = uuidV7();
  const tenantB = uuidV7();
  const organizationA = uuidV7();
  const organizationB = uuidV7();
  const actor = uuidV7();

  afterAll(async () => {
    if (!pool) return;
    for (const tenantId of [tenantA, tenantB]) {
      await withTenantContext(pool, 'app.current_tenant_id', tenantId, (client) =>
        client.query('DELETE FROM tenants WHERE id = $1', [tenantId]),
      );
    }
    await pool.end();
  });

  runIfDatabase('isolates Customer records with FORCE RLS and tenant-local repository queries', async () => {
    pool = new Pool({ connectionString: databaseUrl! });
    await pool.query(
      `INSERT INTO tenants (id, name, subdomain, slug)
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
      [tenantA, 'Customer Test A', `customer-a-${tenantA}`, `customer-a-${tenantA}`, tenantB, 'Customer Test B', `customer-b-${tenantB}`, `customer-b-${tenantB}`],
    );
    await withTenantContext(pool, 'app.current_tenant_id', tenantA, (client) =>
      client.query(`INSERT INTO organizations (id, tenant_id, code, name) VALUES ($1, $2, 'ORGA', 'Organization A')`, [
        organizationA,
        tenantA,
      ]),
    );
    await withTenantContext(pool, 'app.current_tenant_id', tenantB, (client) =>
      client.query(`INSERT INTO organizations (id, tenant_id, code, name) VALUES ($1, $2, 'ORGB', 'Organization B')`, [
        organizationB,
        tenantB,
      ]),
    );

    const repository = new PostgresCustomerRepository(pool);
    const customer = await repository.create({
      tenantId: tenantA,
      organizationId: organizationA,
      name: 'Tenant A Customer',
      actorUserId: actor,
    });

    await expect(repository.getById(tenantA, organizationA, customer.id)).resolves.toMatchObject({
      tenantId: tenantA,
      name: 'Tenant A Customer',
    });
    await expect(repository.getById(tenantB, organizationB, customer.id)).resolves.toBeNull();
    await expect(
      repository.update({
        tenantId: tenantB,
        organizationId: organizationB,
        customerId: customer.id,
        name: 'Cross Tenant Update',
        actorUserId: actor,
      }),
    ).resolves.toBeNull();
    await expect(
      repository.update({
        tenantId: tenantA,
        organizationId: organizationA,
        customerId: customer.id,
        name: 'Updated Customer',
        actorUserId: actor,
      }),
    ).resolves.toMatchObject({ name: 'Updated Customer' });
    await expect(
      repository.softDelete({
        tenantId: tenantA,
        organizationId: organizationA,
        customerId: customer.id,
        actorUserId: actor,
      }),
    ).resolves.toMatchObject({ isDeleted: true });
    await expect(repository.getById(tenantA, organizationA, customer.id)).resolves.toBeNull();
    await expect(repository.list(tenantA, { organizationId: organizationA, page: 1, pageSize: 20 })).resolves.toMatchObject({
      total: 0,
    });

    const unitOfWork = new UnitOfWork(pool);
    await expect(
      unitOfWork.runInTransaction(async () => {
        await repository.create({
          tenantId: tenantA,
          organizationId: organizationA,
          name: 'Rolled Back Customer',
          actorUserId: actor,
        });
        throw new Error('rollback customer mutation');
      }),
    ).rejects.toThrow('rollback customer mutation');
    await expect(
      repository.list(tenantA, { organizationId: organizationA, page: 1, pageSize: 20, search: 'Rolled Back' }),
    ).resolves.toMatchObject({ total: 0 });

    const rlsState = await pool.query(
      `SELECT relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE relname = 'customers' AND relnamespace = 'public'::regnamespace`,
    );
    expect(rlsState.rows[0]).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true });
  });
});

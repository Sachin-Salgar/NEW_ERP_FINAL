import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { v7 } from 'uuid';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { applyTenantTableRls } from '../../src/infrastructure/database/rls.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';

const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
const runIfDatabase = it;

const tenantContextKey = 'app.current_tenant_id';

describe('PostgreSQL tenant isolation', () => {
  let pool: Pool | undefined;

  afterAll(async () => {
    if (!pool) {
      return;
    }

    try {
      await pool.query('DROP TABLE IF EXISTS tenant_rls_demo');
    } finally {
      await pool.end();
    }
  });

  runIfDatabase('enforces transaction-local tenant context using PostgreSQL RLS', async () => {
    pool = new Pool({ connectionString: databaseUrl! });

    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
      await pool.query('DROP TABLE IF EXISTS tenant_rls_demo;');
      await pool.query(`
        CREATE TABLE tenant_rls_demo (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL,
          value text NOT NULL
        );
      `);
      await applyTenantTableRls(pool, {
        tableName: 'tenant_rls_demo',
        tenantColumn: 'tenant_id',
        tenantContextKey,
      });

      const rlsState = await pool.query(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'tenant_rls_demo' AND relnamespace = 'public'::regnamespace;`,
      );
      expect(rlsState.rows[0]?.relrowsecurity).toBe(true);
      expect(rlsState.rows[0]?.relforcerowsecurity).toBe(true);

      const tenantA = v7();
      const tenantB = v7();

      await withTenantContext(pool, tenantContextKey, tenantA, async (client) => {
        const activeTenant = await client.query("SELECT current_setting('app.current_tenant_id', true) AS tenant_id;");
        expect(activeTenant.rows[0]?.tenant_id).toBe(tenantA);

        await client.query('INSERT INTO tenant_rls_demo (tenant_id, value) VALUES ($1, $2)', [tenantA, 'alpha']);

        const rows = await client.query('SELECT * FROM tenant_rls_demo ORDER BY value');
        expect(rows.rowCount).toBe(1);
        expect(rows.rows[0]?.tenant_id).toBe(tenantA);
        expect(rows.rows[0]?.value).toBe('alpha');

        return undefined;
      });

      await withTenantContext(pool, tenantContextKey, tenantB, async (client) => {
        const rows = await client.query('SELECT * FROM tenant_rls_demo');
        expect(rows.rowCount).toBe(0);

        await client.query('INSERT INTO tenant_rls_demo (tenant_id, value) VALUES ($1, $2)', [tenantB, 'beta']);

        const ownRows = await client.query('SELECT * FROM tenant_rls_demo');
        expect(ownRows.rowCount).toBe(1);
        expect(ownRows.rows[0]?.tenant_id).toBe(tenantB);
        expect(ownRows.rows[0]?.value).toBe('beta');

        return undefined;
      });

      await withTenantContext(pool, tenantContextKey, tenantA, async (client) => {
        const rows = await client.query('SELECT * FROM tenant_rls_demo ORDER BY value');
        expect(rows.rowCount).toBe(1);
        expect(rows.rows[0]?.tenant_id).toBe(tenantA);
        expect(rows.rows[0]?.value).toBe('alpha');

        return undefined;
      });

      const tenantC = v7();
      const rollbackClient = await pool.connect();
      try {
        await rollbackClient.query('BEGIN');
        await rollbackClient.query(`SET LOCAL "${tenantContextKey.replace(/"/g, '""')}" = '${tenantC.replace(/'/g, "''")}'`);
        await rollbackClient.query('INSERT INTO tenant_rls_demo (tenant_id, value) VALUES ($1, $2)', [tenantC, 'discarded']);
        await rollbackClient.query('ROLLBACK');
      } finally {
        rollbackClient.release();
      }

      const rollbackRows = await withTenantContext(pool, tenantContextKey, tenantC, async (client) => {
        return client.query('SELECT * FROM tenant_rls_demo WHERE tenant_id = $1', [tenantC]);
      });
      expect(rollbackRows.rowCount).toBe(0);

      const txClientA = await pool.connect();
      try {
        await txClientA.query('BEGIN');
        await txClientA.query(`SET LOCAL "${tenantContextKey.replace(/"/g, '""')}" = '${tenantA.replace(/'/g, "''")}'`);
        const aSetting = await txClientA.query("SELECT current_setting('app.current_tenant_id', true) AS tenant_id;");
        expect(aSetting.rows[0]?.tenant_id).toBe(tenantA);

        const connectionB = await pool.connect();
        try {
          const bSetting = await connectionB.query("SELECT current_setting('app.current_tenant_id', true) AS tenant_id;");
          expect(bSetting.rows[0]?.tenant_id).toBeNull();
        } finally {
          connectionB.release();
        }

        await txClientA.query('ROLLBACK');
      } finally {
        txClientA.release();
      }
    } finally {
      if (pool) {
        await pool.query('DROP TABLE IF EXISTS tenant_rls_demo');
      }
    }
  });
});

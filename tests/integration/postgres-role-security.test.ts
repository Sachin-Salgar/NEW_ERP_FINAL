import dotenv from 'dotenv';
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { resolveDatabaseUrl } from '../../src/config/schema.js';

dotenv.config({ path: '.env.local' });

const adminUrl = resolveDatabaseUrl(process.env);
const testUrl = resolveDatabaseUrl(process.env, { forTest: true });
const rolePassword = process.env.ADR0040_SECURITY_ROLE_PASSWORD ?? `Adr0040-${Date.now()}!`;
const roleNames = ['erp_app', 'erp_platform_executor', 'erp_procedure_owner'] as const;

function roleUrl(role: string): string {
  const url = new URL(testUrl);
  url.username = role;
  url.password = rolePassword;
  return url.toString();
}

function targetAdminUrl(): string {
  const admin = new URL(adminUrl);
  const target = new URL(testUrl);
  admin.pathname = target.pathname;
  return admin.toString();
}

describe('PostgreSQL platform security boundary', () => {
  let admin: Pool;
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    admin = new Pool({ connectionString: targetAdminUrl(), ssl: false });
    const client = await admin.connect();
    try {
      await client.query(fs.readFileSync('scripts/platform-security.sql', 'utf8'));
      for (const role of roleNames) {
        await client.query(`ALTER ROLE ${role} LOGIN PASSWORD '${rolePassword.replaceAll("'", "''")}'`);
      }

      const tenants = await client.query<{ id: string }>(
        'SELECT id FROM tenants WHERE is_deleted = false ORDER BY created_at LIMIT 2',
      );
      if (tenants.rowCount !== 2) {
        throw new Error('PostgreSQL security verification requires two existing tenants');
      }
      [tenantA, tenantB] = tenants.rows.map((row) => row.id);

      await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO erp_app');
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    for (const role of roleNames) {
      await admin.query(`ALTER ROLE ${role} NOLOGIN PASSWORD NULL`);
    }
    await admin.end();
  });

  it('keeps all security roles non-privileged and denies direct executor table access', async () => {
    const flags = await admin.query<{
      rolname: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolreplication: boolean;
    }>(
      `SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
       FROM pg_roles WHERE rolname = ANY($1::text[])`,
      [roleNames],
    );

    expect(flags.rows).toHaveLength(roleNames.length);
    for (const role of flags.rows) {
      expect(role).toMatchObject({
        rolsuper: false,
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolreplication: false,
      });
    }

    const executor = new Pool({ connectionString: roleUrl('erp_platform_executor'), ssl: false });
    try {
      await expect(executor.query('SELECT id FROM customers LIMIT 1')).rejects.toMatchObject({
        code: '42501',
      });
      await expect(executor.query('INSERT INTO customers (id) VALUES (gen_random_uuid())')).rejects.toMatchObject({
        code: '42501',
      });
    } finally {
      await executor.end();
    }
  });

  it('enforces tenant RLS for the application role and restricts procedures', async () => {
    const app = new Pool({ connectionString: roleUrl('erp_app'), ssl: false });
    const executor = new Pool({ connectionString: roleUrl('erp_platform_executor'), ssl: false });
    try {
      const client = await app.connect();
      try {
        await client.query('SELECT set_config($1, $2, false)', ['app.current_tenant_id', tenantA]);
        const crossTenantRead = await client.query('SELECT id FROM customers WHERE tenant_id = $1', [tenantB]);
        expect(crossTenantRead.rows).toHaveLength(0);
        const crossTenantMutation = await client.query(
          'UPDATE customers SET updated_at = updated_at WHERE tenant_id = $1 RETURNING id',
          [tenantB],
        );
        expect(crossTenantMutation.rows).toHaveLength(0);
      } finally {
        client.release();
      }

      const publicExecute = await admin.query<{ allowed: boolean }>(
        `SELECT has_function_privilege('public', 'platform_update_tenant_status(uuid,text)', 'EXECUTE') AS allowed`,
      );
      expect(publicExecute.rows[0].allowed).toBe(false);

      const executorPermission = await admin.query<{ allowed: boolean }>(
        `SELECT has_function_privilege('erp_platform_executor', 'platform_update_tenant_status(uuid,text)', 'EXECUTE') AS allowed`,
      );
      expect(executorPermission.rows[0].allowed).toBe(true);

      await expect(
        executor.query('SELECT platform_update_tenant_status($1::uuid, $2::text)', [
          '00000000-0000-0000-0000-000000000000',
          'active',
        ]),
      ).rejects.toThrow();
    } finally {
      await app.end();
      await executor.end();
    }
  });
});

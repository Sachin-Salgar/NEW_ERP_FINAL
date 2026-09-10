import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { v7 as uuidV7 } from 'uuid';
import { resolveIntegrationAdminDatabaseUrl } from './database.js';
import { runPlatformSecurityBootstrap } from '../../src/infrastructure/database/platform-security.js';

dotenv.config({ path: '.env.local' });

const adminUrl = resolveIntegrationAdminDatabaseUrl();
const testUrl = resolveDatabaseUrl(process.env, { forTest: true });
const rolePassword = randomBytes(24).toString('base64url');
const reverseMembershipRole = `erp_security_parent_${process.pid}`;
const erpDefaultTable = `security_default_erp_${process.pid}`;
const securitySequence = `security_default_sequence_${process.pid}`;
const unrelatedFunction = `security_unrelated_postgres_${process.pid}`;
const roleNames = ['erp', 'erp_app', 'erp_platform_executor', 'erp_procedure_owner'] as const;

function roleUrl(role: string, password = rolePassword): string {
  const url = new URL(testUrl);
  url.username = role;
  url.password = password;
  return url.toString();
}

function targetAdminUrl(): string {
  return adminUrl;
}

describe('PostgreSQL platform security boundary', () => {
  let admin: Pool;
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    admin = new Pool({ connectionString: targetAdminUrl(), ssl: false });
    const client = await admin.connect();
    try {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp') THEN
            CREATE ROLE erp LOGIN NOSUPERUSER NOBYPASSRLS CREATEDB CREATEROLE NOREPLICATION;
          END IF;
        END
        $$;
      `);
      await client.query('ALTER ROLE erp_procedure_owner LOGIN CREATEDB');
      await client.query('ALTER ROLE erp_platform_executor NOLOGIN CREATEDB');
      await client.query('GRANT erp_procedure_owner, erp_platform_executor TO erp WITH ADMIN OPTION');
      await client.query('GRANT EXECUTE ON FUNCTION public.platform_update_tenant_status(uuid, text) TO erp, erp_app');
      await client.query('GRANT EXECUTE ON FUNCTION public.platform_delete_tenant(uuid) TO erp, erp_app');
      await runPlatformSecurityBootstrap(client, { requireErp: true });
      for (const role of ['erp_app', 'erp_platform_executor']) {
        const passwordStatement = await client.query<{ statement: string }>(
          `SELECT format('ALTER ROLE %I PASSWORD %L', $1::text, $2::text) AS statement`,
          [role, rolePassword],
        );
        await client.query(passwordStatement.rows[0].statement);
      }

      const fixtureTenantIds = [uuidV7(), uuidV7()];
      await client.query(
        `INSERT INTO tenants (id, name, subdomain, slug, status)
         VALUES ($1, $2, $3, $4, 'active'), ($5, $6, $7, $8, 'active')`,
        [
          fixtureTenantIds[0],
          `Postgres Security Tenant A ${fixtureTenantIds[0]}`,
          `pg-sec-a-${fixtureTenantIds[0]}`,
          `pg-sec-a-${fixtureTenantIds[0]}`,
          fixtureTenantIds[1],
          `Postgres Security Tenant B ${fixtureTenantIds[1]}`,
          `pg-sec-b-${fixtureTenantIds[1]}`,
          `pg-sec-b-${fixtureTenantIds[1]}`,
        ],
      );
      const tenants = await client.query<{ id: string }>(
        'SELECT id FROM tenants WHERE id = ANY($1::uuid[]) ORDER BY created_at',
        [fixtureTenantIds],
      );
      if (tenants.rowCount !== 2) {
        throw new Error('PostgreSQL security verification requires two existing tenants');
      }
      [tenantA, tenantB] = tenants.rows.map((row) => row.id);

      await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO erp_app');
      await client.query('ALTER FUNCTION public.platform_update_tenant_status(uuid, text) OWNER TO erp');
      await client.query(`
        CREATE OR REPLACE FUNCTION public.platform_update_tenant_status(target_tenant uuid, requested_status text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY INVOKER
        SET search_path = public
        AS $$
        BEGIN
          RAISE EXCEPTION 'intentional test drift';
        END;
        $$;
      `);
      await client.query('GRANT EXECUTE ON FUNCTION public.platform_update_tenant_status(uuid, text) TO erp, erp_app');
      await client.query('REVOKE EXECUTE ON FUNCTION public.platform_update_tenant_status(uuid, text) FROM erp_platform_executor');
      await client.query('GRANT erp_procedure_owner, erp_platform_executor TO erp WITH ADMIN OPTION');
      await client.query(`DROP ROLE IF EXISTS ${reverseMembershipRole}`);
      await client.query(`CREATE ROLE ${reverseMembershipRole} NOLOGIN`);
      await client.query(`GRANT ${reverseMembershipRole} TO erp_procedure_owner`);
      await client.query('ALTER DEFAULT PRIVILEGES FOR ROLE erp GRANT EXECUTE ON FUNCTIONS TO PUBLIC');
      await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE erp GRANT SELECT ON TABLES TO erp_app`);
      await client.query('GRANT CREATE ON SCHEMA public TO erp');
      await client.query(`SET ROLE erp; CREATE TABLE public.${erpDefaultTable} (id integer); RESET ROLE`);
      await client.query(`SET ROLE erp; CREATE SEQUENCE public.${securitySequence}; RESET ROLE`);
      await client.query('REVOKE CREATE ON SCHEMA public FROM erp, erp_app');
      await client.query(
        `CREATE OR REPLACE FUNCTION public.${unrelatedFunction}() RETURNS integer
         LANGUAGE sql AS $$ SELECT 1 $$`,
      );
      const unrelatedBefore = await client.query<{ owner: string; acl: string[] | null }>(
        `SELECT pg_get_userbyid(p.proowner) AS owner, p.proacl AS acl
         FROM pg_proc p
         WHERE p.oid = 'public.${unrelatedFunction}()'::regprocedure`,
      );
      expect(unrelatedBefore.rows[0]?.owner).toBe('postgres');
      await client.query('REVOKE SELECT ON customers FROM erp_app');
      await client.query(`REVOKE SELECT ON SEQUENCE public.${securitySequence} FROM erp_app`);
      await runPlatformSecurityBootstrap(client, { requireErp: true });
    } finally {
      client.release();
    }

  });

  afterAll(async () => {
    const cleanup = await admin.connect();
    try {
      await cleanup.query(`DROP TABLE IF EXISTS public.${erpDefaultTable}`);
      await cleanup.query(`DROP SEQUENCE IF EXISTS public.${securitySequence}`);
      await cleanup.query(`DROP FUNCTION IF EXISTS public.${unrelatedFunction}()`);
      await cleanup.query(`DROP ROLE IF EXISTS ${reverseMembershipRole}`);
      await cleanup.query('DROP ROLE IF EXISTS erp_security_bootstrap_test');
    } finally {
      cleanup.release();
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
      `      SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
       FROM pg_roles WHERE rolname = ANY($1::text[])`,
      [roleNames],
    );

    expect(flags.rows).toHaveLength(roleNames.length);
    for (const role of flags.rows.filter(({ rolname }) => !['erp', 'erp_procedure_owner'].includes(rolname))) {
      expect(role).toMatchObject({
        rolcanlogin: true,
        rolsuper: false,
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolreplication: false,
      });
    }
    expect(flags.rows.find(({ rolname }) => rolname === 'erp_procedure_owner')).toMatchObject({
      rolcanlogin: false,
      rolsuper: false,
      rolbypassrls: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
    });
    expect(flags.rows.find(({ rolname }) => rolname === 'erp')).toMatchObject({
      rolcanlogin: true,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: true,
      rolbypassrls: false,
    });

    const memberships = await admin.query(
      `SELECT member.rolname AS member, parent.rolname AS granted_role
       FROM pg_auth_members
       JOIN pg_roles member ON member.oid = pg_auth_members.member
       JOIN pg_roles parent ON parent.oid = pg_auth_members.roleid
       WHERE member.rolname = ANY($1::text[])
         AND parent.rolname IN ('erp_platform_executor', 'erp_procedure_owner')`,
      [roleNames],
    );
    expect(memberships.rows).toEqual([]);

    const executorSchema = await admin.query<{ usage: boolean; create: boolean }>(
      `SELECT has_schema_privilege('erp_platform_executor', 'public', 'USAGE') AS usage,
              has_schema_privilege('erp_platform_executor', 'public', 'CREATE') AS create`,
    );
    expect(executorSchema.rows[0]).toEqual({ usage: true, create: false });

    const executorTables = await admin.query(
      `SELECT table_name, privilege_type
       FROM information_schema.role_table_grants
       WHERE grantee = 'erp_platform_executor'`,
    );
    expect(executorTables.rows).toEqual([]);

    const executorSequences = await admin.query(
      `SELECT object_name, privilege_type
       FROM information_schema.role_usage_grants
       WHERE grantee = 'erp_platform_executor'`,
    );
    expect(executorSequences.rows).toEqual([]);

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

  it('converges default privileges, application grants, and reverse memberships', async () => {
    const defaults = await admin.query(
      `SELECT defaults.defaclobjtype, owner.rolname AS owner, privilege.privilege_type
       FROM pg_default_acl defaults
       JOIN pg_roles owner ON owner.oid = defaults.defaclrole
       CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege
       WHERE defaults.defaclnamespace = 'public'::regnamespace
         AND owner.rolname IN ('erp', 'erp_app')`,
    );
    expect(defaults.rows).toEqual([]);

    const unrelatedAfter = await admin.query<{ owner: string; acl: string[] | null }>(
      `SELECT pg_get_userbyid(p.proowner) AS owner, p.proacl AS acl
       FROM pg_proc p
       WHERE p.oid = 'public.${unrelatedFunction}()'::regprocedure`,
    );
    expect(unrelatedAfter.rows[0]?.owner).toBe('postgres');

    const appTable = await admin.query<{ allowed: boolean }>(
      `SELECT has_table_privilege('erp_app', 'public.customers', 'SELECT') AS allowed`,
    );
    expect(appTable.rows[0]?.allowed).toBe(true);

    const appSequence = await admin.query<{ allowed: boolean }>(
      `SELECT has_sequence_privilege('erp_app', $1, 'SELECT') AS allowed`,
      [`public.${securitySequence}`],
    );
    expect(appSequence.rows[0]?.allowed).toBe(true);

    const reverseMembership = await admin.query(
      `SELECT 1
       FROM pg_auth_members memberships
       JOIN pg_roles member ON member.oid = memberships.member
       WHERE member.rolname IN ('erp_procedure_owner', 'erp_platform_executor')`,
    );
    expect(reverseMembership.rows).toEqual([]);
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

      const procedureOwner = await admin.query<{
        proname: string;
        owner: string;
        prosecdef: boolean;
        proconfig: string[] | null;
        erpAllowed: boolean;
        appAllowed: boolean;
        executorAllowed: boolean;
        publicAllowed: boolean;
      }>(
        `SELECT p.proname,
                pg_get_userbyid(p.proowner) AS owner,
                p.prosecdef,
                p.proconfig,
                has_function_privilege('erp', p.oid, 'EXECUTE') AS "erpAllowed",
                has_function_privilege('erp_app', p.oid, 'EXECUTE') AS "appAllowed",
                has_function_privilege('erp_platform_executor', p.oid, 'EXECUTE') AS "executorAllowed",
                has_function_privilege('public', p.oid, 'EXECUTE') AS "publicAllowed"
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('platform_update_tenant_status', 'platform_delete_tenant')
         ORDER BY p.proname`,
      );
      expect(procedureOwner.rows).toHaveLength(2);
      for (const functionRow of procedureOwner.rows) {
        expect(functionRow.owner).toBe('erp_procedure_owner');
        expect(functionRow.prosecdef).toBe(true);
        expect(functionRow.proconfig).toEqual(['search_path=pg_catalog, public']);
        expect(functionRow.erpAllowed).toBe(false);
        expect(functionRow.appAllowed).toBe(false);
        expect(functionRow.executorAllowed).toBe(true);
        expect(functionRow.publicAllowed).toBe(false);
      }

      const ownerTables = await admin.query(
        `SELECT table_name, privilege_type
         FROM information_schema.role_table_grants
         WHERE grantee = 'erp_procedure_owner'
         ORDER BY table_name, privilege_type`,
      );
      expect(ownerTables.rows).toEqual([
        { table_name: 'audit_events', privilege_type: 'SELECT' },
        { table_name: 'branches', privilege_type: 'SELECT' },
        { table_name: 'tenants', privilege_type: 'SELECT' },
        { table_name: 'tenants', privilege_type: 'UPDATE' },
        { table_name: 'users', privilege_type: 'SELECT' },
      ]);

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

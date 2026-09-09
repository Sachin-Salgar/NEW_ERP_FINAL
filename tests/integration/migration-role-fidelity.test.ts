import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

import { runMigrations } from '../../src/infrastructure/database/migrate.js';
import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { resolveIntegrationAdminDatabaseUrl } from './database.js';
import { runPlatformSecurityBootstrap } from '../../src/infrastructure/database/platform-security.js';

dotenv.config({ path: '.env.local' });

const migrationRole = `erp_migration_fidelity_${process.pid}`;
const migrationPassword = randomBytes(24).toString('base64url');
const databaseName = `newerp_migration_fidelity_${process.pid}`;
const adminDatabaseUrl = (() => {
  const url = new URL(resolveIntegrationAdminDatabaseUrl());
  url.pathname = '/postgres';
  return url.toString();
})();

describe('production-equivalent migration role', () => {
  afterAll(async () => {
    const admin = new Client({ connectionString: adminDatabaseUrl, ssl: false });
    await admin.connect();
    try {
      await admin.query(
        `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [databaseName],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.query(`DROP ROLE IF EXISTS "${migrationRole}"`);
    } finally {
      await admin.end();
    }
  });

  it(
    'applies migration 0009 as a non-superuser production-equivalent erp role',
    async () => {
      const admin = new Client({ connectionString: adminDatabaseUrl, ssl: false });
      await admin.connect();
      try {
        await admin.query(
          `CREATE ROLE "${migrationRole}"
           LOGIN PASSWORD '${migrationPassword}'
           NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS`,
        );
        await admin.query(`CREATE DATABASE "${databaseName}" OWNER "${migrationRole}"`);
      } finally {
        await admin.end();
      }

      const sourceUrl = new URL(resolveDatabaseUrl(process.env, { forTest: true }));
      sourceUrl.pathname = `/${databaseName}`;
      sourceUrl.username = migrationRole;
      sourceUrl.password = migrationPassword;
      await runMigrations(sourceUrl.toString(), 'disable');

      const securityAdminUrl = new URL(adminDatabaseUrl);
      securityAdminUrl.pathname = `/${databaseName}`;
      const securityAdmin = new Client({ connectionString: securityAdminUrl.toString(), ssl: false });
      await securityAdmin.connect();
      try {
        await runPlatformSecurityBootstrap(securityAdmin);
      } finally {
        await securityAdmin.end();
      }

      const verification = new Client({ connectionString: sourceUrl.toString(), ssl: false });
      await verification.connect();
      try {
        const migration = await verification.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM public."__drizzle_migrations"',
        );
        expect(migration.rows[0]?.count).toBe('10');
        const role = await verification.query<{ rolcanlogin: boolean; rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean; rolbypassrls: boolean }>(
          `SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
           FROM pg_roles WHERE rolname = current_user`,
        );
        expect(role.rows[0]).toEqual({
          rolcanlogin: true,
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: true,
          rolbypassrls: false,
        });

        const security = await verification.query<{
          owner: string;
          prosecdef: boolean;
          executor_allowed: boolean;
          public_allowed: boolean;
        }>(
          `SELECT pg_get_userbyid(p.proowner) AS owner,
                  p.prosecdef,
                  has_function_privilege('erp_platform_executor', p.oid, 'EXECUTE') AS executor_allowed,
                  has_function_privilege('public', p.oid, 'EXECUTE') AS public_allowed
           FROM pg_proc p
           WHERE p.oid = ANY($1::regprocedure[])
           ORDER BY p.oid`,
          [['public.platform_update_tenant_status(uuid,text)', 'public.platform_delete_tenant(uuid)']],
        );
        expect(security.rows).toHaveLength(2);
        for (const fn of security.rows) {
          expect(fn.owner).toBe('erp_procedure_owner');
          expect(fn.prosecdef).toBe(true);
          expect(fn.executor_allowed).toBe(true);
          expect(fn.public_allowed).toBe(false);
        }
        const memberships = await verification.query(
          `SELECT 1
           FROM pg_auth_members memberships
           JOIN pg_roles member ON member.oid = memberships.member
           WHERE member.rolname IN ('erp_procedure_owner', 'erp_platform_executor')`,
        );
        expect(memberships.rows).toEqual([]);
        const defaults = await verification.query(
          `SELECT 1
           FROM pg_default_acl defaults
           JOIN pg_roles owner ON owner.oid = defaults.defaclrole
           CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege
           WHERE defaults.defaclnamespace = 'public'::regnamespace
             AND owner.rolname IN ('erp', 'erp_app')`,
        );
        expect(defaults.rows).toEqual([]);
      } finally {
        await verification.end();
      }
    },
    120_000,
  );
});

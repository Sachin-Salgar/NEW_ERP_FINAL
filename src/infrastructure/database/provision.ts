import { Client } from 'pg';

import { createDatabaseClientOptions } from './connection.js';
import { runMigrations } from './migrate.js';
import { runPlatformSecurityBootstrapFromUrl } from './platform-security-bootstrap.js';
import { seedPlatformAdmin } from './platform-admin-seed.js';

type ProvisioningConfig = {
  provisioningUrl: string;
  migrationUrl: string;
  runtimeUrl: string;
  sslMode: 'disable' | 'require';
  sslCa?: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for database provisioning.`);
  return value;
}

function sslMode(): 'disable' | 'require' {
  return process.env.DATABASE_SSL_MODE === 'disable' ? 'disable' : 'require';
}

function configFromEnv(): ProvisioningConfig {
  return {
    provisioningUrl: required('DB_PROVISIONING_DATABASE_URL'),
    migrationUrl: required('DB_MIGRATION_DATABASE_URL'),
    runtimeUrl: required('DATABASE_URL'),
    sslMode: sslMode(),
    sslCa: process.env.DATABASE_SSL_CA,
  };
}

async function ensureMigrationRole(config: ProvisioningConfig): Promise<void> {
  const migration = new URL(config.migrationUrl);
  const migrationRole = decodeURIComponent(migration.username);
  const migrationPassword = decodeURIComponent(migration.password);

  if (migrationRole !== 'erp') {
    throw new Error(`DB_MIGRATION_DATABASE_URL must use the canonical migration role "erp", received "${migrationRole}".`);
  }

  const client = new Client(createDatabaseClientOptions(config.provisioningUrl, config.sslMode, config.sslCa));
  try {
    await client.connect();
    const existing = await client.query<{ rolname: string; rolcanlogin: boolean; rolcreaterole: boolean }>(
      'SELECT rolname, rolcanlogin, rolcreaterole FROM pg_roles WHERE rolname = $1',
      ['erp'],
    );

    if (existing.rows.length === 0) {
      const passwordLiteral = await client.query<{ value: string }>('SELECT quote_literal($1) AS value', [migrationPassword]);
      await client.query(
        `CREATE ROLE erp LOGIN NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${passwordLiteral.rows[0].value}`,
      );
      console.log('Created canonical migration role: erp');
    } else if (!existing.rows[0].rolcanlogin || !existing.rows[0].rolcreaterole) {
      await client.query(
        'ALTER ROLE erp LOGIN NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS',
      );
    }

    // PostgreSQL 15+ no longer grants CREATE on the public schema to PUBLIC.
    // The canonical migration role must be able to create the migration table
    // and application objects before the later security bootstrap hardens access.
    await client.query(
      'GRANT CONNECT ON DATABASE current_database() TO erp',
    ).catch(async (error: unknown) => {
      if (!(error instanceof Error) || !/syntax error/i.test(error.message)) throw error;
      await client.query('SELECT 1');
      await client.query(
        `GRANT CONNECT ON DATABASE ${JSON.stringify('newerp')} TO erp`,
      );
    });
    await client.query('GRANT USAGE, CREATE ON SCHEMA public TO erp');
  } finally {
    await client.end();
  }
}

async function inspectEndpoint(url: string, label: string, config: ProvisioningConfig) {
  const client = new Client(createDatabaseClientOptions(url, config.sslMode, config.sslCa));
  try {
    await client.connect();
    const result = await client.query<{
      database: string;
      role: string;
      server_version: string;
    }>('SELECT current_database() AS database, current_user AS role, current_setting(\'server_version\') AS server_version');
    const row = result.rows[0];
    if (!row) throw new Error(`Unable to inspect ${label} database endpoint.`);
    return row;
  } finally {
    await client.end();
  }
}

async function verifyProvisionedDatabase(config: ProvisioningConfig): Promise<void> {
  const client = new Client(createDatabaseClientOptions(config.provisioningUrl, config.sslMode, config.sslCa));
  try {
    await client.connect();

    const migration = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM public."__drizzle_migrations"',
    );
    if (Number(migration.rows[0]?.count ?? 0) < 1) {
      throw new Error('Database provisioning completed without recorded migrations.');
    }
    const roles = await client.query<{ rolname: string }>(
      `SELECT rolname
         FROM pg_roles
        WHERE rolname = ANY($1::text[])
        ORDER BY rolname`,
      [['erp_app', 'erp_platform_executor', 'erp_procedure_owner']],
    );
    if (roles.rows.length !== 3) {
      throw new Error('Database provisioning completed without all required dedicated roles.');
    }

    const platformAdmin = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM platform_memberships
        WHERE status = 'active'`,
    );
    if (Number(platformAdmin.rows[0]?.count ?? 0) < 1) {
      throw new Error('Database provisioning completed without an active platform administrator.');
    }

    const sessionRls = await client.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relrowsecurity, relforcerowsecurity
         FROM pg_class
         JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'user_sessions'`,
    );
    if (sessionRls.rows.length !== 1 || !sessionRls.rows[0].relrowsecurity || !sessionRls.rows[0].relforcerowsecurity) {
      throw new Error('user_sessions RLS/FORCE RLS is not enabled after provisioning.');
    }
  } finally {
    await client.end();
  }
}

export async function provisionDatabase(): Promise<void> {
  const config = configFromEnv();

  console.log('==> Database provisioning: bootstrap migration role');
  await ensureMigrationRole(config);

  console.log('==> Database provisioning: preflight');
  const [provisioning, migration, runtime] = await Promise.all([
    inspectEndpoint(config.provisioningUrl, 'provisioning', config),
    inspectEndpoint(config.migrationUrl, 'migration', config),
    inspectEndpoint(config.runtimeUrl, 'runtime', config),
  ]);

  if (provisioning.database !== migration.database || provisioning.database !== runtime.database) {
    throw new Error(
      `Database endpoint mismatch: provisioning=${provisioning.database}, migration=${migration.database}, runtime=${runtime.database}.`,
    );
  }

  console.log(
    `Database ${provisioning.database} / PostgreSQL ${provisioning.server_version} preflight passed.`,
  );
  console.log(`Provisioning role: ${provisioning.role}; migration role: ${migration.role}; runtime role: ${runtime.role}`);

  console.log('==> Database provisioning: migrations');
  await runMigrations(config.migrationUrl, config.sslMode);

  console.log('==> Database provisioning: security/RLS bootstrap');
  await runPlatformSecurityBootstrapFromUrl(config.provisioningUrl, config.sslMode, config.sslCa);

  console.log('==> Database provisioning: platform administrator bootstrap');
  await seedPlatformAdmin(config.provisioningUrl, config.sslMode, config.sslCa);

  console.log('==> Database provisioning: final verification');
  await verifyProvisionedDatabase(config);

  console.log('==> Database provisioning completed successfully.');
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1].replaceAll('\\\\', '/')) {
  provisionDatabase().catch((error: unknown) => {
    console.error('Database provisioning failed', error);
    process.exitCode = 1;
  });
}

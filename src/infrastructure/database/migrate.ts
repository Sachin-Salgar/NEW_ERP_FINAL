import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { loadConfig } from '../../config/index.js';
import { createDatabaseClientOptions, type DatabaseSslMode } from './connection.js';

const MIGRATION_TABLE = '__drizzle_migrations';

const migrationChecks: Record<string, (client: Client) => Promise<boolean>> = {
  '0000_core-platform-phase-1': async (client) => {
    const tableNames = [
      'tenants',
      'tenant_subscriptions',
      'tenant_modules',
      'organizations',
      'branches',
      'financial_years',
      'users',
      'roles',
      'permissions',
      'role_permissions',
      'user_sessions',
      'user_roles',
      'user_permissions',
      'user_organization_access',
      'user_branch_access',
      'modules',
      'subscription_plans',
    ];
    const typeNames = [
      'fy_status_enum',
      'org_status_enum',
      'permission_scope_enum',
      'reset_policy_enum',
      'subscription_status_enum',
      'tenant_status_enum',
      'user_status_enum',
    ];

    for (const tableName of tableNames) {
      if (!(await tableExists(client, tableName))) {
        return false;
      }
    }

    for (const typeName of typeNames) {
      if (!(await typeExists(client, typeName))) {
        return false;
      }
    }

    return true;
  },
  '0001_location-domain': async (client) =>
    (await tableExists(client, 'locations')) &&
    (await tableExists(client, 'user_location_access')) &&
    (await columnExists(client, 'user_sessions', 'location_id')) &&
    !(await columnExists(client, 'user_location_access', 'id')),
  '0002-organization-module-access': async (client) =>
    (await tableExists(client, 'organization_modules')) &&
    (await tableExists(client, 'tenant_modules')) &&
    (await functionExists(client, 'initialize_core_organization_modules')) &&
    (await functionExists(client, 'initialize_core_tenant_modules')) &&
    (await triggerExists(client, 'trg_initialize_core_organization_modules', 'organizations')) &&
    (await triggerExists(client, 'trg_initialize_core_tenant_modules', 'tenants')) &&
    (await policyExists(client, 'organization_modules', 'organization_modules_tenant_org_isolation_policy')),
  '0003-identity-based-login': async (client) =>
    (await tableExists(client, 'auth_login_identifiers')) &&
    (await columnExists(client, 'users', 'tenant_id')) &&
    (await indexExists(client, 'idx_auth_login_identifiers_lookup')),
  '0004-sync-login-identifiers': async (client) =>
    (await functionExists(client, 'sync_auth_login_identifiers')) &&
    (await triggerExists(client, 'trg_sync_auth_login_identifiers', 'users')),
  '0005-code-counters': async (client) =>
    (await tableExists(client, 'code_counters')) &&
    (await policyExists(client, 'code_counters', 'code_counters_tenant_isolation_policy')),
  '0006-default-location-context': async (client) =>
    (await columnExists(client, 'users', 'default_location_id')) &&
    (await constraintExists(client, 'users', 'fk_user_location_tenant')),
  '0007-audit-events': async (client) =>
    (await tableExists(client, 'audit_events')) &&
    (await policyExists(client, 'audit_events', 'audit_events_tenant_isolation_policy')) &&
    (await triggerExists(client, 'trg_prevent_audit_event_update', 'audit_events')) &&
    (await triggerExists(client, 'trg_prevent_audit_event_delete', 'audit_events')),
};

async function tableExists(client: Client, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>('SELECT to_regclass($1) IS NOT NULL AS exists', [
    `public.${tableName}`,
  ]);
  return result.rows[0]?.exists ?? false;
}

async function columnExists(client: Client, tableName: string, columnName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists;`,
    [tableName, columnName],
  );

  return result.rows[0]?.exists ?? false;
}

async function functionExists(client: Client, functionName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>('SELECT to_regprocedure($1) IS NOT NULL AS exists', [
    `public.${functionName}`,
  ]);
  return result.rows[0]?.exists ?? false;
}

async function triggerExists(client: Client, triggerName: string, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = $1
        AND t.tgname = $2
    ) AS exists;`,
    [tableName, triggerName],
  );
  return result.rows[0]?.exists ?? false;
}

async function indexExists(client: Client, indexName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = $1
     ) AS exists;`,
    [indexName],
  );
  return result.rows[0]?.exists ?? false;
}

async function policyExists(client: Client, tableName: string, policyName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = $1
         AND policyname = $2
     ) AS exists;`,
    [tableName, policyName],
  );
  return result.rows[0]?.exists ?? false;
}

async function constraintExists(client: Client, tableName: string, constraintName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.table_constraints
       WHERE table_schema = 'public'
         AND table_name = $1
         AND constraint_name = $2
     ) AS exists;`,
    [tableName, constraintName],
  );
  return result.rows[0]?.exists ?? false;
}

async function typeExists(client: Client, typeName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>('SELECT to_regtype($1) IS NOT NULL AS exists', [
    `public.${typeName}`,
  ]);
  return result.rows[0]?.exists ?? false;
}

async function ensureMigrationTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public."${MIGRATION_TABLE}" (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function readMigrationJournal(): Promise<Array<{ tag: string }>> {
  const journalPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations', 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries?: Array<{ tag?: string }> };

  return (journal.entries ?? []).flatMap((entry) => {
    if (typeof entry.tag !== 'string' || entry.tag.length === 0) {
      return [];
    }
    return [{ tag: entry.tag }];
  });
}

async function migrationAlreadyTracked(client: Client, hash: string): Promise<boolean> {
  const result = await client.query<{ hash: string }>(
    `SELECT 1 FROM public."${MIGRATION_TABLE}" WHERE hash = $1 LIMIT 1`,
    [hash],
  );
  return (result.rowCount ?? 0) > 0;
}

async function markMigrationApplied(client: Client, hash: string): Promise<void> {
  await client.query(`INSERT INTO public."${MIGRATION_TABLE}" (hash) VALUES ($1) ON CONFLICT (hash) DO NOTHING`, [
    hash,
  ]);
}

async function applyMigrationFile(client: Client, filePath: string): Promise<void> {
  const sql = readFileSync(filePath, 'utf8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.query(statement);
  }
}

export async function runMigrations(databaseUrl?: string, sslMode?: DatabaseSslMode): Promise<void> {
  const config = databaseUrl ? undefined : loadConfig();
  const resolvedUrl = databaseUrl ?? config!.DATABASE_URL;
  const client = new Client(
    createDatabaseClientOptions(resolvedUrl, sslMode ?? config?.DATABASE_SSL_MODE ?? 'require'),
  );

  try {
    await client.connect();
    await client.query(`SELECT pg_advisory_lock(hashtext('new-erp-final:migrations'))`);
    try {
      await ensureMigrationTable(client);

      const migrationDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
      const journalEntries = await readMigrationJournal();

      for (const entry of journalEntries) {
        const fileName = `${entry.tag}.sql`;
        const filePath = path.join(migrationDir, fileName);

        if (!existsSync(filePath)) {
          throw new Error(`Migration file not found for journal entry: ${fileName}`);
        }

        const migrationHash = createHash('sha256').update(readFileSync(filePath)).digest('hex');

        if (await migrationAlreadyTracked(client, migrationHash)) {
          console.log(`Skipping already-applied migration: ${fileName}`);
          continue;
        }

        const migrationAlreadyExists = migrationChecks[entry.tag] ? await migrationChecks[entry.tag](client) : false;

        if (migrationAlreadyExists) {
          console.log(
            `Migration ${fileName} is already present in the database schema; recording migration state without replay.`,
          );
          await markMigrationApplied(client, migrationHash);
          continue;
        }

        console.log(`Applying migration: ${fileName}`);
        await applyMigrationFile(client, filePath);
        await markMigrationApplied(client, migrationHash);
        console.log(`Applied migration: ${fileName}`);
      }

      console.log('Database migration check complete.');
    } finally {
      await client.query(`SELECT pg_advisory_unlock(hashtext('new-erp-final:migrations'))`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  await runMigrations();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error('Database bootstrap failed', error);
    process.exitCode = 1;
  });
}

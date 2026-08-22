import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { loadConfig } from '../../config/index.js';

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
  '0001_location-domain-foundation': async (client) => tableExists(client, 'locations'),
  '0002_location-authorization': async (client) =>
    (await tableExists(client, 'user_location_access')) &&
    (await columnExists(client, 'user_location_access', 'location_id')) &&
    (await columnExists(client, 'user_location_access', 'organization_id')),
  '0003_active-location-selection': async (client) => columnExists(client, 'user_sessions', 'location_id'),
  '0004_fix_location_access_schema': async (client) =>
    !(await columnExists(client, 'user_location_access', 'id')) &&
    (await columnExists(client, 'user_sessions', 'location_id')) &&
    (await tableExists(client, 'user_location_access')),
};

async function tableExists(client: Client, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [`public.${tableName}`],
  );
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

async function typeExists(client: Client, typeName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    'SELECT to_regtype($1) IS NOT NULL AS exists',
    [`public.${typeName}`],
  );
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
  await client.query(
    `INSERT INTO public."${MIGRATION_TABLE}" (hash) VALUES ($1) ON CONFLICT (hash) DO NOTHING`,
    [hash],
  );
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

async function main() {
  const config = loadConfig();
  const client = new Client({ connectionString: config.DATABASE_URL });

  try {
    await client.connect();
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

      const migrationAlreadyExists = migrationChecks[entry.tag]
        ? await migrationChecks[entry.tag](client)
        : false;

      if (migrationAlreadyExists) {
        console.log(`Migration ${fileName} is already present in the database schema; recording migration state without replay.`);
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
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Database bootstrap failed', error);
  process.exitCode = 1;
});

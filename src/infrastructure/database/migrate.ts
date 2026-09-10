import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { loadConfig } from '../../config/index.js';
import { createDatabaseClientOptions, type DatabaseSslMode } from './connection.js';

const MIGRATION_TABLE = '__drizzle_migrations';

const migrationChecks: Record<string, (client: Client) => Promise<boolean>> = {
  '0000_core_platform': async (client) =>
    (await tableExists(client, 'identities')) &&
    (await tableExists(client, 'tenant_memberships')) &&
    (await tableExists(client, 'platform_memberships')) &&
    (await tableExists(client, 'audit_events')) &&
    (await functionExists(client, 'platform_update_tenant_status(uuid,text)')) &&
    (await policyExists(client, 'audit_events', 'audit_events_context_visibility_policy')),
  '0001_customer': (client) => tableExists(client, 'customers'),
  '0002_sales': (client) => tableExists(client, 'sales_quotations'),
  '0003_inventory': (client) => tableExists(client, 'inventory_items'),
  '0004_procurement': (client) => tableExists(client, 'procurement_purchase_orders'),
  '0005_finance': (client) => tableExists(client, 'finance_postings'),
  '0006_tax': (client) => tableExists(client, 'tax_rules'),
  '0010_pending_login_challenges': pendingLoginChallengesMatchMigration,
};

async function tableExists(client: Client, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>('SELECT to_regclass($1) IS NOT NULL AS exists', [
    `public.${tableName}`,
  ]);
  return result.rows[0]?.exists ?? false;
}

async function functionExists(client: Client, functionName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>('SELECT to_regprocedure($1) IS NOT NULL AS exists', [
    `public.${functionName}`,
  ]);
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

async function pendingLoginChallengesMatchMigration(client: Client): Promise<boolean> {
  const table = await client.query<{
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
  }>(
    `SELECT c.relrowsecurity, c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'pending_login_challenges'`,
  );
  if (
    table.rows.length !== 1 ||
    table.rows[0].relrowsecurity ||
    table.rows[0].relforcerowsecurity
  ) {
    return false;
  }

  const columns = await client.query<{
    ordinal_position: number;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: string;
    column_default: string | null;
    character_maximum_length: number | null;
  }>(
    `SELECT ordinal_position, column_name, data_type, udt_name, is_nullable,
            column_default, character_maximum_length
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'pending_login_challenges'
      ORDER BY ordinal_position`,
  );
  const expectedColumns = [
    ['challenge_id', 'uuid', 'uuid', 'NO', null, null],
    ['identity_id', 'uuid', 'uuid', 'NO', null, null],
    ['secret_hash', 'character varying', 'varchar', 'NO', null, 64],
    ['context_snapshot', 'jsonb', 'jsonb', 'NO', null, null],
    ['created_at', 'timestamp with time zone', 'timestamptz', 'NO', 'now()', null],
    ['expires_at', 'timestamp with time zone', 'timestamptz', 'NO', null, null],
    ['consumed_at', 'timestamp with time zone', 'timestamptz', 'YES', null, null],
  ];
  if (
    JSON.stringify(
      columns.rows.map((column) => [
        column.column_name,
        column.data_type,
        column.udt_name,
        column.is_nullable,
        column.column_default?.replace(/\s+/g, ''),
        column.character_maximum_length,
      ]),
    ) !== JSON.stringify(expectedColumns.map(([name, dataType, udt, nullable, defaultValue, length]) => [
      name,
      dataType,
      udt,
      nullable,
      typeof defaultValue === 'string' ? defaultValue.replace(/\s+/g, '') : defaultValue,
      length,
    ]))
  ) {
    return false;
  }

  const constraints = await client.query<{ conname: string; definition: string }>(
    `SELECT conname, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
      WHERE conrelid = 'public.pending_login_challenges'::regclass
        AND conname IN (
          'pending_login_challenges_pkey',
          'pending_login_challenges_secret_hash_key',
          'pending_login_challenges_identity_id_fkey',
          'pending_login_challenges_expiry_check',
          'pending_login_challenges_consumed_check'
        )
      ORDER BY conname`,
  );
  const expectedConstraints = [
    ['pending_login_challenges_consumed_check', 'CHECK (((consumed_at IS NULL) OR (consumed_at >= created_at)))'],
    ['pending_login_challenges_expiry_check', 'CHECK ((expires_at > created_at))'],
    ['pending_login_challenges_identity_id_fkey', 'FOREIGN KEY (identity_id) REFERENCES identities(id)'],
    ['pending_login_challenges_pkey', 'PRIMARY KEY (challenge_id)'],
    ['pending_login_challenges_secret_hash_key', 'UNIQUE (secret_hash)'],
  ];
  if (JSON.stringify(constraints.rows.map((constraint) => [constraint.conname, constraint.definition])) !== JSON.stringify(expectedConstraints)) {
    return false;
  }

  const indexes = await client.query<{ indexname: string; indexdef: string }>(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'pending_login_challenges'
      ORDER BY indexname`,
  );
  const expectedIndexes = [
    ['pending_login_challenges_identity_expiry_idx', 'CREATE INDEX pending_login_challenges_identity_expiry_idx ON public.pending_login_challenges USING btree (identity_id, expires_at)'],
    ['pending_login_challenges_pkey', 'CREATE UNIQUE INDEX pending_login_challenges_pkey ON public.pending_login_challenges USING btree (challenge_id)'],
    ['pending_login_challenges_secret_hash_key', 'CREATE UNIQUE INDEX pending_login_challenges_secret_hash_key ON public.pending_login_challenges USING btree (secret_hash)'],
    ['pending_login_challenges_unconsumed_expiry_idx', 'CREATE INDEX pending_login_challenges_unconsumed_expiry_idx ON public.pending_login_challenges USING btree (expires_at) WHERE (consumed_at IS NULL)'],
  ];
  if (JSON.stringify(indexes.rows.map((index) => [index.indexname, index.indexdef])) !== JSON.stringify(expectedIndexes)) {
    return false;
  }

  const policies = await client.query(
    `SELECT 1
       FROM pg_policy
      WHERE polrelid = 'public.pending_login_challenges'::regclass`,
  );
  return policies.rows.length === 0;
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

async function hasMigrationHistory(client: Client): Promise<boolean> {
  const result = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public."${MIGRATION_TABLE}"`,
  );
  return result.rows[0]?.count !== '0';
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
      const firstEntry = journalEntries[0];
      if (!firstEntry) {
        throw new Error('Migration journal must contain at least one migration.');
      }
      const baselinePath = path.join(migrationDir, `${firstEntry.tag}.sql`);
      const baselineHash = createHash('sha256').update(readFileSync(baselinePath)).digest('hex');
      if (!(await migrationAlreadyTracked(client, baselineHash)) && (await hasMigrationHistory(client))) {
        throw new Error(
          'Historical migration state detected. Development databases must be rebuilt from zero before applying the consolidated baseline.',
        );
      }

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
        await client.query('BEGIN');
        try {
          await applyMigrationFile(client, filePath);
          await markMigrationApplied(client, migrationHash);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
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

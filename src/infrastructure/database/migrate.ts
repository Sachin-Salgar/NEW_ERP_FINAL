import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { loadConfig } from '../../config/index.js';
import { createDatabaseClientOptions, type DatabaseSslMode } from './connection.js';
import { runPlatformSecurityBootstrapFromEnv } from './platform-security-bootstrap.js';

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

  // Render's existing start command is intentionally kept stable:
  // `npm run db:migrate && node dist/main.js`.
  // Therefore the deployment preflight must establish platform security
  // invariants before the application startup verifier runs.
  if (process.env.RENDER === 'true') {
    await runPlatformSecurityBootstrapFromEnv();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error('Database bootstrap failed', error);
    process.exitCode = 1;
  });
}

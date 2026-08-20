import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { loadConfig } from '../../config/index.js';

async function main() {
  const config = loadConfig();
  const client = new Client({ connectionString: config.DATABASE_URL });

  try {
    await client.connect();
    const migrationDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
    const files = readdirSync(migrationDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = readFileSync(path.join(migrationDir, file), 'utf8');
      const statements = sql
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await client.query(statement);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Database bootstrap failed', error);
  process.exitCode = 1;
});

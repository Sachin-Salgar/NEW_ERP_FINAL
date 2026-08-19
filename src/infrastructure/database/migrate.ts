import { Client } from 'pg';

import { loadConfig } from '../../config/index.js';

async function main() {
  const config = loadConfig();
  const client = new Client({ connectionString: config.DATABASE_URL });

  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await client.query('CREATE SCHEMA IF NOT EXISTS app;');
  await client.end();
}

main().catch((error: unknown) => {
  console.error('Database bootstrap failed', error);
  process.exitCode = 1;
});

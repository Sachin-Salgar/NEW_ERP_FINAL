import { Client } from 'pg';

import { createDatabaseClientOptions } from './connection.js';
import { runPlatformSecurityBootstrap } from './platform-security.js';

export async function runPlatformSecurityBootstrapFromUrl(databaseUrl: string, sslMode: 'disable' | 'require' = 'require', sslCa?: string): Promise<void> {
  const client = new Client(createDatabaseClientOptions(databaseUrl, sslMode, sslCa));
  try {
    await client.connect();
    await runPlatformSecurityBootstrap(client, { requireErp: true });
    console.log('Platform security bootstrap and verification completed.');
  } finally {
    await client.end();
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1].replaceAll('\\', '/')) {
  runPlatformSecurityBootstrapFromUrl(process.env.DB_PROVISIONING_DATABASE_URL ?? '', process.env.DATABASE_SSL_MODE === 'disable' ? 'disable' : 'require', process.env.DATABASE_SSL_CA).catch((error: unknown) => {
    console.error('Platform security bootstrap failed', error);
    process.exitCode = 1;
  });
}

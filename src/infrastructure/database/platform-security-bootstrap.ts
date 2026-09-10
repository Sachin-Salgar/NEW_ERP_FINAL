import { Client } from 'pg';

import { runPlatformSecurityBootstrap } from './platform-security.js';

export async function runPlatformSecurityBootstrapFromEnv(): Promise<void> {
  const databaseUrl = process.env.PLATFORM_SECURITY_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'PLATFORM_SECURITY_DATABASE_URL is required. Run the platform security bootstrap with a separately provisioned privileged operator credential.',
    );
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await runPlatformSecurityBootstrap(client, { requireErp: true });
    console.log('Platform security bootstrap and verification completed.');
  } finally {
    await client.end();
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1].replaceAll('\\', '/')) {
  runPlatformSecurityBootstrapFromEnv().catch((error: unknown) => {
    console.error('Platform security bootstrap failed', error);
    process.exitCode = 1;
  });
}

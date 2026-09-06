import { beforeAll } from 'vitest';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { runMigrations } from '../../src/infrastructure/database/migrate.js';

beforeAll(async () => {
  if (process.env.SKIP_INTEGRATION_MIGRATIONS === 'true') return;
  const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
  await runMigrations(databaseUrl, 'disable');
});

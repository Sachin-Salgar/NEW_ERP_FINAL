import { beforeAll } from 'vitest';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { runMigrations } from '../../src/infrastructure/database/migrate.js';

beforeAll(async () => {
  const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
  await runMigrations(databaseUrl);
});

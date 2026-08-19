import type { Config } from 'drizzle-kit';
import { loadConfig } from './src/config/index.js';

const config = loadConfig();

export default {
  schema: './src/infrastructure/database/schema.ts',
  out: './src/infrastructure/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.DATABASE_URL,
  },
} satisfies Config;

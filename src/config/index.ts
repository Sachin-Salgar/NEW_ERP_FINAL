import { existsSync } from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

import { parseAppConfig } from './schema.js';

const envPath = existsSync(path.resolve(process.cwd(), '.env.local')) ? '.env.local' : '.env';

dotenv.config({ path: envPath, override: false });

export const loadConfig = () => parseAppConfig(process.env);

export * from './schema.js';

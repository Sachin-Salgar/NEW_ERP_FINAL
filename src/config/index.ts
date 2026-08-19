import { parseAppConfig } from './schema.js';

export const loadConfig = () => parseAppConfig(process.env);

export * from './schema.js';

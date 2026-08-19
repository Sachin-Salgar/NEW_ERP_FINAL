import { z } from 'zod';

export const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

export const appConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().trim().min(1).default('new-erp-final'),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().trim().default('/api/v1'),
  LOG_LEVEL: z.enum(logLevels).default('info'),
  DATABASE_URL: z.string().trim().min(1).default('postgresql://erp:erp@localhost:5432/erp_dev'),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  JWT_SECRET: z.string().trim().min(32).default('development-jwt-secret-change-me'),
  JWT_ISSUER: z.string().trim().min(1).default('new-erp-final'),
  TENANT_HEADER: z.string().trim().min(1).default('x-tenant-id'),
  TENANT_CONTEXT_KEY: z.string().trim().min(1).default('app.current_tenant_id'),
});

export type AppConfig = z.infer<typeof appConfigSchema> & {
  isDevelopment: boolean;
  isTest: boolean;
  isProduction: boolean;
};

export type LogLevel = z.infer<typeof appConfigSchema>['LOG_LEVEL'];

export function parseAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = appConfigSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`).join('; ');
    throw new Error(`Invalid application configuration: ${issues}`);
  }

  const config = parsed.data as AppConfig;
  const isDevelopment = config.NODE_ENV === 'development';
  const isTest = config.NODE_ENV === 'test';
  const isProduction = config.NODE_ENV === 'production';

  if (isProduction && (config.JWT_SECRET === 'development-jwt-secret-change-me' || !config.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be configured for production deployments.');
  }

  return {
    ...config,
    isDevelopment,
    isTest,
    isProduction,
  };
}

import dotenv from 'dotenv';
import { z } from 'zod';

export const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

export const appConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().trim().min(1).default('new-erp-final'),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().trim().default('/api/v1'),
  LOG_LEVEL: z.enum(logLevels).default('info'),
  DATABASE_URL: z.string().trim().min(1),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  JWT_SECRET: z.string().trim().min(32).default('development-jwt-secret-change-me'),
  JWT_ISSUER: z.string().trim().min(1).default('new-erp-final'),
  TENANT_HEADER: z.string().trim().min(1).default('x-tenant-id'),
  TENANT_CONTEXT_KEY: z.string().trim().min(1).default('app.current_tenant_id'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.string().min(1)))
    .default('http://localhost:8090,http://localhost:7358,http://127.0.0.1:8090,http://127.0.0.1:7358'),
});

export type AppConfig = z.infer<typeof appConfigSchema> & {
  isDevelopment: boolean;
  isTest: boolean;
  isProduction: boolean;
};

export type LogLevel = z.infer<typeof appConfigSchema>['LOG_LEVEL'];

export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  options: { forTest?: boolean } = {},
): string {
  const key = options.forTest ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
  let value = env[key]?.trim();

  if (!value && env === process.env) {
    dotenv.config({ path: '.env.local', override: true });
    value = process.env[key]?.trim();
  }

  if (!value) {
    if (options.forTest) {
      throw new Error(
        'TEST_DATABASE_URL is not configured. Set TEST_DATABASE_URL in .env.local. The integration test database will not be created automatically.',
      );
    }

    throw new Error(
      'DATABASE_URL is not configured. Set DATABASE_URL in .env.local. The application will not create or select another database automatically.',
    );
  }

  return value;
}

export function parseAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  dotenv.config({ path: '.env.local', override: true });

  resolveDatabaseUrl(env);

  const parsed = appConfigSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
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
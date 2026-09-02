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
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(25),
  JWT_SECRET: z.string().trim().min(32).default('development-jwt-secret-change-me'),
  JWT_ISSUER: z.string().trim().min(1).default('new-erp-final'),
  TENANT_CONTEXT_KEY: z.string().trim().min(1).default('app.current_tenant_id'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.string().min(1)))
    .default(''),
});

export type AppConfig = z.infer<typeof appConfigSchema> & {
  isDevelopment: boolean;
  isTest: boolean;
  isProduction: boolean;
};

export type LogLevel = z.infer<typeof appConfigSchema>['LOG_LEVEL'];

/**
 * Determines whether a browser Origin may use the API.
 *
 * Development/test intentionally accept any HTTP localhost/loopback port because
 * Flutter Web and other local dev servers choose ephemeral ports. Production
 * remains restricted to the explicit CORS_ALLOWED_ORIGINS allowlist.
 */
export function isCorsOriginAllowed(config: AppConfig, origin?: string): boolean {
  if (!origin) {
    return true;
  }

  if (config.CORS_ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  if (!config.isDevelopment && !config.isTest) {
    return false;
  }

  try {
    const url = new URL(origin);
    const isLoopbackHost =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]' ||
      url.hostname === '::1';

    return url.protocol === 'http:' && isLoopbackHost;
  } catch {
    return false;
  }
}

export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  options: { forTest?: boolean } = {},
): string {
  const key = options.forTest ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
  let value = env[key]?.trim();

  if (!value && env === process.env) {
    dotenv.config({ path: '.env.local', override: false });
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
  dotenv.config({ path: '.env.local', override: false });

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

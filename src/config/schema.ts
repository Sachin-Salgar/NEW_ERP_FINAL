import dotenv from 'dotenv';
import { z } from 'zod';

export const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;
export const databaseSslModes = ['disable', 'require'] as const;
export const jwtSigningAlgorithms = ['HS256', 'RS256'] as const;

export const appConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().trim().min(1).default('new-erp-final'),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().trim().default('/api/v1'),
  LOG_LEVEL: z.enum(logLevels).default('info'),
  DATABASE_URL: z.string().trim().min(1),
  DATABASE_SSL_MODE: z.enum(databaseSslModes).default('require'),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(25),
  JWT_SECRET: z.string().trim().min(32).default('development-jwt-secret-change-me'),
  JWT_ISSUER: z.string().trim().min(1).default('new-erp-final'),
  JWT_SIGNING_ALGORITHM: z.enum(jwtSigningAlgorithms).default('HS256'),
  JWT_RS256_KEYS_JSON: z.string().trim().default('[]'),
  JWT_ACCEPT_LEGACY_HS256: z.coerce.boolean().default(false),
  TENANT_CONTEXT_KEY: z.string().trim().min(1).default('app.current_tenant_id'),
  AUTH_LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(5),
  AUTH_REGISTER_RATE_LIMIT: z.coerce.number().int().positive().default(5),
  AUTH_REFRESH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  AUTH_PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).max(128).default(12),
  AUTH_PASSWORD_REQUIRE_UPPERCASE: z.coerce.boolean().default(true),
  AUTH_PASSWORD_REQUIRE_LOWERCASE: z.coerce.boolean().default(true),
  AUTH_PASSWORD_REQUIRE_NUMBER: z.coerce.boolean().default(true),
  AUTH_PASSWORD_REQUIRE_SYMBOL: z.coerce.boolean().default(true),
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

export function resolveDatabaseSslMode(env: NodeJS.ProcessEnv = process.env): (typeof databaseSslModes)[number] {
  const value = env.DATABASE_SSL_MODE?.trim() || 'require';

  if (!databaseSslModes.includes(value as (typeof databaseSslModes)[number])) {
    throw new Error(`Invalid DATABASE_SSL_MODE: ${value}. Expected disable or require.`);
  }

  return value as (typeof databaseSslModes)[number];
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

  if (
    isProduction &&
    config.JWT_SIGNING_ALGORITHM === 'HS256' &&
    (config.JWT_SECRET === 'development-jwt-secret-change-me' || !config.JWT_SECRET)
  ) {
    throw new Error('JWT_SECRET must be configured for production HS256 compatibility deployments.');
  }

  if (config.JWT_SIGNING_ALGORITHM === 'RS256') {
    try {
      const keys = JSON.parse(config.JWT_RS256_KEYS_JSON) as unknown;
      if (!Array.isArray(keys) || keys.length === 0) {
        throw new Error('no keys configured');
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'invalid JSON';
      throw new Error(`JWT_RS256_KEYS_JSON must contain the configured RS256 key ring: ${detail}`);
    }

    if (isProduction && config.JWT_ACCEPT_LEGACY_HS256 && config.JWT_SECRET === 'development-jwt-secret-change-me') {
      throw new Error('A production legacy HS256 verification window requires an explicitly configured JWT_SECRET.');
    }
  }

  return {
    ...config,
    isDevelopment,
    isTest,
    isProduction,
  };
}

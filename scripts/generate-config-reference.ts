import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { z } from 'zod';

import { appConfigSchema } from '../src/config/schema.js';

const OUTPUT_PATH = resolve(process.cwd(), 'docs/04-backend/configuration-reference.md');

const descriptions: Record<string, string> = {
  NODE_ENV: 'Application runtime environment.',
  APP_NAME: 'Application/service name used by runtime integrations and logging.',
  HOST: 'HTTP bind host.',
  PORT: 'HTTP listen port.',
  API_PREFIX: 'Base prefix for REST API routes.',
  LOG_LEVEL: 'Minimum application log level.',
  DATABASE_URL: 'Primary PostgreSQL connection URL. Required.',
  DATABASE_SSL_MODE: 'PostgreSQL TLS mode used by the application connection pool.',
  DATABASE_POOL_MIN: 'Minimum desired PostgreSQL pool size.',
  DATABASE_POOL_MAX: 'Maximum PostgreSQL pool size.',
  JWT_SECRET: 'Symmetric JWT signing secret. Production must override the development default.',
  JWT_ISSUER: 'Issuer claim used for JWT creation and validation.',
  TENANT_CONTEXT_KEY: 'PostgreSQL session setting used to propagate tenant context for RLS.',
  AUTH_LOGIN_RATE_LIMIT: 'Maximum login requests allowed within the configured auth rate-limit window.',
  AUTH_REGISTER_RATE_LIMIT: 'Maximum registration requests allowed within the configured auth rate-limit window.',
  AUTH_REFRESH_RATE_LIMIT: 'Maximum refresh-token requests allowed within the configured auth rate-limit window.',
  AUTH_RATE_LIMIT_WINDOW_MS: 'Authentication rate-limit window in milliseconds.',
  AUTH_MAX_FAILED_ATTEMPTS: 'Failed login attempts allowed before account lockout.',
  AUTH_LOCKOUT_MINUTES: 'Account lockout duration in minutes.',
  AUTH_PASSWORD_MIN_LENGTH: 'Minimum accepted password length.',
  AUTH_PASSWORD_REQUIRE_UPPERCASE: 'Whether passwords must contain an uppercase character.',
  AUTH_PASSWORD_REQUIRE_LOWERCASE: 'Whether passwords must contain a lowercase character.',
  AUTH_PASSWORD_REQUIRE_NUMBER: 'Whether passwords must contain a number.',
  AUTH_PASSWORD_REQUIRE_SYMBOL: 'Whether passwords must contain a symbol.',
  CORS_ALLOWED_ORIGINS: 'Comma-separated exact browser origins allowed in production. Development/test also permit loopback HTTP origins.',
};

function unwrap(schema: z.ZodTypeAny): { base: z.ZodTypeAny; defaultValue?: unknown } {
  let current = schema;
  let defaultValue: unknown;

  while (true) {
    if (current instanceof z.ZodDefault) {
      defaultValue = current._def.defaultValue();
      current = current._def.innerType;
      continue;
    }

    if (current instanceof z.ZodEffects) {
      current = current._def.schema;
      continue;
    }

    if (current instanceof z.ZodPipeline) {
      current = current._def.in;
      continue;
    }

    if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
      current = current.unwrap();
      continue;
    }

    return { base: current, defaultValue };
  }
}

function typeName(schema: z.ZodTypeAny): string {
  const { base } = unwrap(schema);

  if (base instanceof z.ZodString) return 'string';
  if (base instanceof z.ZodNumber) return 'number';
  if (base instanceof z.ZodBoolean) return 'boolean';
  if (base instanceof z.ZodEnum) return base.options.map((value) => `\`${value}\``).join(' | ');
  if (base instanceof z.ZodArray) return `${typeName(base.element)}[]`;

  return base._def.typeName ?? 'unknown';
}

function formatDefault(value: unknown): string {
  if (value === undefined) return '—';
  if (Array.isArray(value)) return value.length === 0 ? '`[]`' : `\`${JSON.stringify(value)}\``;
  if (typeof value === 'string') return value.length === 0 ? 'empty string' : `\`${value}\``;
  return `\`${String(value)}\``;
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function buildDocument(): string {
  const rows = Object.entries(appConfigSchema.shape).map(([name, schema]) => {
    const { defaultValue } = unwrap(schema);
    const required = defaultValue === undefined ? 'Yes' : 'No';

    return `| \`${name}\` | ${escapeCell(typeName(schema))} | ${required} | ${escapeCell(formatDefault(defaultValue))} | ${escapeCell(descriptions[name] ?? '')} |`;
  });

  return `# Backend Configuration Reference\n\n> Generated from \`src/config/schema.ts\` by \`npm run docs:config\`. Do not edit the generated table manually.\n\n## Application configuration\n\n| Variable | Type | Required | Default | Purpose |\n|---|---|---:|---|---|\n${rows.join('\n')}\n\n## Supporting environment variables\n\nThese variables are used by development, testing, or PostgreSQL tooling but are not members of \`appConfigSchema\`.\n\n| Variable | Purpose |\n|---|---|\n| \`TEST_DATABASE_URL\` | Explicit PostgreSQL connection URL used by integration tests. Tests fail rather than silently creating/selecting another database when it is absent. |\n| \`PGHOST\`, \`PGPORT\`, \`PGDATABASE\`, \`PGUSER\`, \`PGPASSWORD\` | Optional standard PostgreSQL client/tooling variables used by local scripts or administrative tooling. They are not authoritative application database configuration; the backend uses \`DATABASE_URL\`. |\n\n## Security notes\n\n- Production deployments must provide a strong \`JWT_SECRET\`; the development default is rejected in production.\n- \`DATABASE_SSL_MODE\` defaults to \`require\`. Use \`disable\` only where the deployment/database network is explicitly designed for it.\n- Tenant identity is not configured through an environment variable. Tenant context is derived by the application and propagated to PostgreSQL using \`TENANT_CONTEXT_KEY\`; do not bypass the established RLS flow.\n- Keep secrets in deployment/environment secret stores. Do not commit real credentials to repository files.\n\n## Local setup\n\nCopy \`.env.example\` to \`.env.local\`, replace placeholder database credentials and secrets, and keep \`.env.local\` uncommitted.\n`;
}

await writeFile(OUTPUT_PATH, buildDocument(), 'utf8');
console.log(`Wrote ${OUTPUT_PATH}`);

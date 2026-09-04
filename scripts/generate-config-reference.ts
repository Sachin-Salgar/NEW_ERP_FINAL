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
  JWT_SECRET: 'HS256 signing secret and temporary legacy verification secret during an explicitly enabled RS256 migration window.',
  JWT_ISSUER: 'Issuer claim used for JWT creation and validation.',
  JWT_SIGNING_ALGORITHM: 'JWT issuance mode. RS256 is the approved production migration target; HS256 remains the compatibility default until deployment key material is configured.',
  JWT_RS256_KEYS_JSON: 'JSON-encoded RS256 key ring. Entries contain kid, lifecycle state, public key PEM, and private PEM only for the active signing key. Store private material in deployment secret storage.',
  JWT_ACCEPT_LEGACY_HS256: 'Allows already-issued HS256 tokens to verify during a bounded RS256 migration window. Do not leave enabled indefinitely.',
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

function getDefaultValue(schema: z.ZodTypeAny): unknown {
  let current = schema;

  while (true) {
    if (current instanceof z.ZodDefault) {
      return current._def.defaultValue();
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

    return undefined;
  }
}

function unwrapForType(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;

  while (true) {
    if (current instanceof z.ZodDefault) {
      current = current._def.innerType;
      continue;
    }

    if (current instanceof z.ZodEffects) {
      current = current._def.schema;
      continue;
    }

    if (current instanceof z.ZodPipeline) {
      current = current._def.out;
      continue;
    }

    if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
      current = current.unwrap();
      continue;
    }

    return current;
  }
}

function typeName(schema: z.ZodTypeAny): string {
  const base = unwrapForType(schema);

  if (base instanceof z.ZodString) return 'string';
  if (base instanceof z.ZodNumber) return 'number';
  if (base instanceof z.ZodBoolean) return 'boolean';
  if (base instanceof z.ZodEnum) return base.options.map((value) => `\`${value}\``).join(' | ');
  if (base instanceof z.ZodArray) return `${typeName(base.element)}[]`;

  return String(base._def.typeName ?? 'unknown');
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
    const defaultValue = getDefaultValue(schema);
    const required = defaultValue === undefined ? 'Yes' : 'No';

    return `| \`${name}\` | ${escapeCell(typeName(schema))} | ${required} | ${escapeCell(formatDefault(defaultValue))} | ${escapeCell(descriptions[name] ?? '')} |`;
  });

  return `# Backend Configuration Reference\n\n> Generated from \`src/config/schema.ts\` by \`npm run docs:config\`. Do not edit the generated table manually.\n\n## Application configuration\n\n| Variable | Type | Required | Default | Purpose |\n|---|---|---:|---|---|\n${rows.join('\n')}\n\n## Supporting environment variables\n\nThese variables are used by development, testing, or PostgreSQL tooling but are not members of \`appConfigSchema\`.\n\n| Variable | Purpose |\n|---|---|\n| \`TEST_DATABASE_URL\` | Explicit PostgreSQL connection URL used by integration tests. Tests fail rather than silently creating/selecting another database when it is absent. |\n| \`PGHOST\`, \`PGPORT\`, \`PGDATABASE\`, \`PGUSER\`, \`PGPASSWORD\` | Optional standard PostgreSQL client/tooling variables used by local scripts or administrative tooling. They are not authoritative application database configuration; the backend uses \`DATABASE_URL\`. |\n\n## Security notes\n\n- ADR-0021 and \`docs/06-security/06-jwt-key-management-baseline.md\` select RS256 as the target asymmetric signing mode. Current deployments may remain on HS256 until stable RS256 key material is configured and validated.\n- Production HS256 compatibility deployments must provide a strong \`JWT_SECRET\`; the development default is rejected.\n- When \`JWT_SIGNING_ALGORITHM=RS256\`, \`JWT_RS256_KEYS_JSON\` must contain exactly one active signing key plus any verification-only overlap keys. Retired keys are not published in JWKS or accepted for verification.\n- \`JWT_ACCEPT_LEGACY_HS256=true\` is only for the controlled migration window and requires a real legacy secret in production.\n- \`DATABASE_SSL_MODE\` defaults to \`require\`. Use \`disable\` only where the deployment/database network is explicitly designed for it.\n- Tenant identity is not configured through an environment variable. Tenant context is derived by the application and propagated to PostgreSQL using \`TENANT_CONTEXT_KEY\`; do not bypass the established RLS flow.\n- Keep secrets in deployment/environment secret stores. Do not commit real credentials or private signing keys to repository files.\n\n## Local setup\n\nCopy \`.env.example\` to \`.env.local\`, replace placeholder database credentials and secrets, and keep \`.env.local\` uncommitted.\n`;
}

await writeFile(OUTPUT_PATH, buildDocument(), 'utf8');
console.log(`Wrote ${OUTPUT_PATH}`);

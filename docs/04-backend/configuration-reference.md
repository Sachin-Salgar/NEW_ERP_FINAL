# Backend Configuration Reference

> Generated from `src/config/schema.ts` by `npm run docs:config`. Do not edit the generated table manually.

## Application configuration

| Variable | Type | Required | Default | Purpose |
|---|---|---:|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` | No | `development` | Application runtime environment. |
| `APP_NAME` | string | No | `new-erp-final` | Application/service name used by runtime integrations and logging. |
| `HOST` | string | No | `0.0.0.0` | HTTP bind host. |
| `PORT` | number | No | `3000` | HTTP listen port. |
| `API_PREFIX` | string | No | `/api/v1` | Base prefix for REST API routes. |
| `LOG_LEVEL` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` | No | `info` | Minimum application log level. |
| `DATABASE_URL` | string | Yes | — | Primary PostgreSQL connection URL. Required. |
| `DATABASE_SSL_MODE` | `disable` \| `require` | No | `require` | PostgreSQL TLS mode used by the application connection pool. |
| `DATABASE_POOL_MIN` | number | No | `1` | Minimum desired PostgreSQL pool size. |
| `DATABASE_POOL_MAX` | number | No | `25` | Maximum PostgreSQL pool size. |
| `JWT_SECRET` | string | No | `development-jwt-secret-change-me` | Symmetric JWT signing secret. Production must override the development default. |
| `JWT_ISSUER` | string | No | `new-erp-final` | Issuer claim used for JWT creation and validation. |
| `TENANT_CONTEXT_KEY` | string | No | `app.current_tenant_id` | PostgreSQL session setting used to propagate tenant context for RLS. |
| `AUTH_LOGIN_RATE_LIMIT` | number | No | `5` | Maximum login requests allowed within the configured auth rate-limit window. |
| `AUTH_REGISTER_RATE_LIMIT` | number | No | `5` | Maximum registration requests allowed within the configured auth rate-limit window. |
| `AUTH_REFRESH_RATE_LIMIT` | number | No | `10` | Maximum refresh-token requests allowed within the configured auth rate-limit window. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | number | No | `60000` | Authentication rate-limit window in milliseconds. |
| `AUTH_MAX_FAILED_ATTEMPTS` | number | No | `5` | Failed login attempts allowed before account lockout. |
| `AUTH_LOCKOUT_MINUTES` | number | No | `15` | Account lockout duration in minutes. |
| `AUTH_PASSWORD_MIN_LENGTH` | number | No | `12` | Minimum accepted password length. |
| `AUTH_PASSWORD_REQUIRE_UPPERCASE` | boolean | No | `true` | Whether passwords must contain an uppercase character. |
| `AUTH_PASSWORD_REQUIRE_LOWERCASE` | boolean | No | `true` | Whether passwords must contain a lowercase character. |
| `AUTH_PASSWORD_REQUIRE_NUMBER` | boolean | No | `true` | Whether passwords must contain a number. |
| `AUTH_PASSWORD_REQUIRE_SYMBOL` | boolean | No | `true` | Whether passwords must contain a symbol. |
| `CORS_ALLOWED_ORIGINS` | string[] | No | empty string | Comma-separated exact browser origins allowed in production. Development/test also permit loopback HTTP origins. |

## Supporting environment variables

These variables are used by development, testing, or PostgreSQL tooling but are not members of `appConfigSchema`.

| Variable | Purpose |
|---|---|
| `TEST_DATABASE_URL` | Explicit PostgreSQL connection URL used by integration tests. Tests fail rather than silently creating/selecting another database when it is absent. |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Optional standard PostgreSQL client/tooling variables used by local scripts or administrative tooling. They are not authoritative application database configuration; the backend uses `DATABASE_URL`. |

## Security notes

- Production deployments must provide a strong `JWT_SECRET`; the development default is rejected in production.
- `DATABASE_SSL_MODE` defaults to `require`. Use `disable` only where the deployment/database network is explicitly designed for it.
- Tenant identity is not configured through an environment variable. Tenant context is derived by the application and propagated to PostgreSQL using `TENANT_CONTEXT_KEY`; do not bypass the established RLS flow.
- Keep secrets in deployment/environment secret stores. Do not commit real credentials to repository files.

## Local setup

Copy `.env.example` to `.env.local`, replace placeholder database credentials and secrets, and keep `.env.local` uncommitted.

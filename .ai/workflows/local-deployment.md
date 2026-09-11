# Local Deployment and Startup Runbook

This runbook is the canonical local deployment procedure for NEW_ERP_FINAL. Follow it before starting local backend or frontend work.

## Required local authority

- Read `.ai/authority.md` before any local deployment attempt.
- Read `.env.local` and run `npm run db:diagnose` before starting services.
- Do not invent database credentials, roles, or database names.
- Do not print or commit secrets.
- Preserve all pre-existing user changes.
- Leave the ERP stack running for local developer use once it passes validation.

## Canonical local PostgreSQL configuration

Local PostgreSQL is expected on `localhost:5432`.

Runtime application connection:
- database: `newerp`
- role: `erp_app`
- variable: `DATABASE_URL`
- purpose: application runtime access under tenant/RLS boundaries

Integration test connection:
- database: `newerp_test`
- role: `newerp_test_runner`
- variable: `TEST_DATABASE_URL`
- purpose: isolated integration testing

Administrative/bootstrap connection:
- database: `newerp`
- role: `postgres`
- variables: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`
- purpose: local schema migration, platform-security bootstrap, and privileged setup

Platform/security bootstrap variables:
- `INTEGRATION_ADMIN_DATABASE_URL=postgresql://postgres@localhost:5432/newerp`
- `PLATFORM_SECURITY_DATABASE_URL=postgresql://postgres@localhost:5432/newerp`

Important rules:
- `erp_app` is the runtime application role; do not substitute the test role for app runtime.
- `newerp_test_runner` is the integration test role; do not use it for runtime application access.
- `erp` is the migration/admin role used when repository setup requires it.
- `erp_platform_executor` and `erp_procedure_owner` are platform security roles; they are not local app credentials.
- `.env.local` is the local secret source. It is not committed.
- `DATABASE_URL` and `TEST_DATABASE_URL` must remain separate and are not interchangeable.

## Canonical startup command

Use the repository-controlled startup script instead of ad-hoc commands:

```powershell
./scripts/start-local-dev.ps1
```

This script:
- verifies PostgreSQL with `npm run db:diagnose`
- aborts immediately if DB connectivity fails
- detects stale listeners on ports 3000 and 3001 without blindly killing unrelated processes
- starts the backend from the repository root
- waits for `http://localhost:3000/api/v1/health` to return HTTP 200 with `database.connected === true`
- starts the Flutter web app from `frontend/` with `--web-port 3001 --dart-define=API_BASE_URL=http://localhost:3000`
- waits for `http://localhost:3001` to return HTTP 200
- checks whether the local tenant user state is present; if it is missing, bootstraps the local development tenant using `npx tsx --env-file .env.local bootstrap-dev-user.ts`
- verifies a real login request and one authenticated API request before reporting readiness
- leaves both processes running for local developer usage

Do not start backend/frontend with random one-off commands when this script exists.

## Canonical startup order

1. Confirm PostgreSQL is running on `localhost:5432`.
2. Run the repository diagnostic:
   - `npm run db:diagnose`
3. If the runtime role fails to authenticate, do not guess credentials. Confirm the actual local administrator connection and verify the intended role/database pair and then update `.env.local` only after verification.
4. Run the canonical startup command:
   - `./scripts/start-local-dev.ps1`
5. Verify the backend is listening on `http://localhost:3000`.
6. Verify backend health:
   - `http://localhost:3000/api/v1/health`
   - `http://localhost:3000/api/v1/health/ready`
7. Verify the frontend is serving on `http://localhost:3001`.
8. Verify a real login against `POST http://localhost:3000/api/v1/auth/login` and then one authenticated request against `GET http://localhost:3000/api/v1/auth/me`.

## Canonical validation

Runtime database connectivity:
- `npm run db:diagnose`
- expected result: `DATABASE_URL` connects as `erp_app` to `newerp`
- expected result: `TEST_DATABASE_URL` connects as `newerp_test_runner` to `newerp_test`

Local tenant bootstrap check:
- if the runtime database has no local tenant user state, the canonical startup script runs `npx tsx --env-file .env.local bootstrap-dev-user.ts`
- expected result: a valid local tenant user and login credentials are created without changing the app’s runtime credentials or auth architecture

Backend health:
- `GET http://localhost:3000/api/v1/health`
- expected: HTTP 200 and `database.connected` is `true`

Frontend health:
- `GET http://localhost:3001`
- expected: the Flutter web app responds successfully on the configured port

Login verification:
- `POST http://localhost:3000/api/v1/auth/login`
- expected: HTTP success and a valid session/token response
- authenticated follow-up: `GET http://localhost:3000/api/v1/auth/me` with `Authorization: Bearer <token>`

## Failure handling and stale processes

If ports 3000 or 3001 are already occupied:

1. Check whether the listener is the ERP backend/frontend process or an unrelated process.
2. Do not blindly kill unknown processes.
3. If the port is occupied by an unrelated process, stop and report the conflict.
4. If the port is occupied by the same repository's dev process, validate the service before starting a duplicate.
5. If the process is stale or not healthy, use the canonical script to restart the stack only after confirming the port conflict is actually from the ERP dev stack.

## Troubleshooting

If PostgreSQL rejects the runtime role with `password authentication failed for user erp_app`:

1. Do not guess credentials.
2. Read `.env.local` and verify the app role is `erp_app` and the database is `newerp`.
3. Run `npm run db:diagnose`.
4. Reconnect using the documented local administrative PostgreSQL role (`PGUSER=postgres`) and verify the actual local role configuration.
5. Reset only the application role if the local admin connection confirms that the app role is the intended runtime login.
6. Re-run `npm run db:diagnose` before starting the backend.

If the frontend port responds with a raw placeholder HTML page, do not call it a successful ERP app startup. That often indicates a stale or unrelated Flutter shell rather than the actual ERP frontend. The canonical startup script waits for the actual HTTP response and then performs login verification before declaring the stack ready.

## Stop and logs

To stop the local stack cleanly, stop the backend and frontend processes started by the repo script. Their logs are written to:

- `.local-dev-logs/backend.log`
- `.local-dev-logs/frontend.log`

## Copilot rule

Before every local deployment attempt, read this runbook and `.env.local`, run `npm run db:diagnose`, verify the required roles and databases, and use the documented startup sequence. Do not invent credentials, do not substitute test credentials for runtime credentials, and never print or commit secrets.

Do not repeatedly start backend/frontend with random ad-hoc commands. The canonical startup path is `./scripts/start-local-dev.ps1`.

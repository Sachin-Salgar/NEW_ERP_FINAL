# Current Deployment Topology — 2026-09-21

**Status:** Current deployed topology and operator runbook  
**Authority:** This document records verified deployment evidence. It does not override approved ADRs.  
**Scope:** Local development, GitHub CI, Vercel frontend, Render backend, and Render PostgreSQL.

## 1. Current production topology

```text
Browser
  |
  | HTTPS
  v
Vercel — Flutter Web
  |
  | HTTPS API calls using API_BASE_URL
  v
Render Web Service — NEW_ERP_FINAL
  |  https://new-erp-final.onrender.com
  |  Docker / Node 22 application
  |
  | DATABASE_URL
  v
Render PostgreSQL 18 — erppostgres
  |
  +--> erp_app
  |      normal application CRUD + RLS
  |
  +--> erp_platform_executor
  |      EXECUTE only on approved platform lifecycle procedures
  |
  +--> erp_procedure_owner
  |      NOLOGIN SECURITY DEFINER function owner
  |
  +--> erp_user
         Render-managed database owner/operator
```

The public frontend is deployed at https://erp.salgar.in. The backend is deployed at https://new-erp-final.onrender.com. The frontend never connects directly to PostgreSQL.

## 2. Vercel frontend

Repository configuration:
- Build command: `bash scripts/vercel-build.sh`
- Output directory: `frontend/build/web`
- SPA rewrite: all browser routes to `/index.html`
- Flutter Web build receives `API_BASE_URL` through `--dart-define`.
- The frontend treats API_BASE_URL as connectivity configuration, never tenant authority.
- Production authentication was verified against the deployed backend on 2026-09-21.

The repository does not store Vercel secret/environment values. They remain deployment-platform configuration.

## 3. Render backend

Verified Render service:
- Service: NEW_ERP_FINAL
- Service ID: `srv-dao1di142hec7383djjg`
- Branch: `main`
- Region: Singapore
- Runtime: Docker
- Plan: Free
- Auto deploy: commit to `main`
- Health endpoint: `/api/v1/health/live`
- Production Render URL: https://new-erp-final.onrender.com

Runtime credential boundaries:
| Credential | Runtime purpose |
|---|---|
| `DATABASE_URL` | `erp_app`; normal application database access |
| `PLATFORM_DATABASE_URL` | `erp_platform_executor`; approved platform lifecycle procedures |
| `PLATFORM_SECURITY_DATABASE_URL` | privileged operator/bootstrap only; never a web-service runtime credential |

The Render Blueprint intentionally does not inject privileged credentials into the web service.

Application startup performs connectivity and platform-security verification. It does not create databases, create roles, run migrations, or perform privileged security bootstrap.

## 4. Render PostgreSQL

Verified database:
- Name: `erppostgres`
- ID: `dpg-dao9nb6k1f9s73b7faj0-a`
- PostgreSQL: 18
- Database: `erp_database_c17z`
- Render-managed owner: `erp_user`
- Region: Singapore
- Current plan: Free
- Current expiry shown by Render: 2026-10-21

The Render-managed owner is provider infrastructure and is not an application runtime role.

### Important observed provider state

On 2026-09-21, live catalog inspection showed:
- `erp_app`: LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS.
- `erp_platform_executor`: LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS.
- `erp_procedure_owner`: NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS.
- `erp`: LOGIN, NOSUPERUSER, CREATEROLE, NOCREATEDB, NOBYPASSRLS.
- `erp_user`: Render-managed LOGIN owner/admin role.

The Render owner currently retains provider-managed memberships to the four ERP roles. The bootstrap verifier explicitly excludes the current database owner from the application-role membership normalization check so provider-managed ownership does not fail startup.

### Ownership drift finding

Live application tables are currently owned by `erp_user`, while the repository architecture describes `erp` as the object-creating migration role.

This is deployment drift/evidence, not a new architecture decision. Do not silently transfer ownership in production. Any future ownership change must be an explicit migration/provider operation with a rollback plan.

## 5. Database role contract

The intended logical contract remains:
- `erp`: schema migration/object-creation role.
- `erp_app`: normal application runtime role.
- `erp_platform_executor`: narrowly scoped platform procedure executor.
- `erp_procedure_owner`: SECURITY DEFINER procedure owner.
- provider-managed database owner/operator: external administrative boundary.

No normal web runtime may use the privileged provider owner.

## 6. Database migration lifecycle

### Local
1. Start PostgreSQL 17.
2. Configure `.env.local`.
3. Diagnose with `npm run db:diagnose`.
4. Run migrations using the documented migration role.
5. Run `npm run db:security-bootstrap` using the privileged local operator connection.
6. Start the application with `DATABASE_URL=erp_app`.
7. Run the canonical local startup/validation workflow.

### CI
GitHub PostgreSQL integration creates a disposable PostgreSQL 17 environment, separates migration/application/bootstrap credentials, runs migrations and platform-security bootstrap, seeds deterministic fixtures, starts the backend, and executes Flutter Web E2E tests.

CI is the clean-database regression authority for role/RLS/deployment-boundary behavior.

### Render production
Production provisioning is an operator action, not application startup:
1. Provision/verify database roles using the Render-managed owner/operator.
2. Run migrations with the intended migration credential.
3. Run the platform-security bootstrap with the privileged operator credential.
4. Verify role attributes, memberships, RLS, function ownership, function EXECUTE grants, and application grants.
5. Configure the web service with only runtime credentials.
6. Deploy the application.
7. Validate health and authentication.

Never place `PLATFORM_SECURITY_DATABASE_URL` in the web service.

## 7. Production database changes
A production schema change must not rely on web-service startup.

Before release:
1. Run CI migration and security tests against clean PostgreSQL.
2. Verify the migration's expected object owner and privileges.
3. Apply the migration using the documented operator/migration path.
4. Run the platform-security verification.
5. Deploy the application.
6. Validate health, authentication, authorization, and relevant business operations.

The repository's current Render setup does not expose a privileged migration command in the web startup path. A dedicated operator/deployment path must be used for production schema changes.

## 8. Seed data
`scripts/seed-custom-tenant.ts` is a controlled deployment-test fixture, not general production initialization.

It requires explicit:
- `CUSTOM_TENANT_SEED_ENABLED=true`
- `CUSTOM_TENANT_SEED_ALLOW_PRODUCTION=true` in production
- three password environment variables.

Passwords must never be committed or placed in `.ai` or documentation.

## 9. Release safety rule
Never fix a deployment mismatch by weakening:
- RLS;
- `erp_app` role attributes;
- platform procedure EXECUTE boundaries;
- function SECURITY DEFINER/search_path protections;
- tenant context validation;
- provider/runtime credential separation.

If live provider state differs from the intended architecture, record the drift, preserve the running system, and resolve it through an explicit migration/ADR/operator change.

## 10. Cross references
- `docs/07-devops/01-deployment-architecture.md`
- `docs/07-devops/03-environment-management.md`
- `docs/07-devops/05-ci-cd-pipeline.md`
- `docs/03-database/16-security-architecture.md`
- `.ai/workflows/deployment.md`
- `.ai/workflows/local-deployment.md`
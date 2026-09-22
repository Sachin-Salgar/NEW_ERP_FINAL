# Deployment and Environment Audit Workflow

This is the canonical AI workflow for deployment, infrastructure, database-role, and environment changes in NEW_ERP_FINAL.

## 1. Authority
1. Read `.ai/authority.md`.
2. Read `docs/00-overview/03-implementation-roadmap.md`.
3. Read `docs/07-devops/01-deployment-architecture.md`.
4. Read `docs/07-devops/12-current-deployment-topology.md`.
5. Read `docs/03-database/16-security-architecture.md`.
6. Inspect `render.yaml`, `vercel.json`, `Dockerfile`, build/start scripts, environment schema, migration runner, and platform-security bootstrap.
7. Inspect relevant CI workflows.
8. Inspect current provider state when provider tools are available.

## 2. Environment boundaries
Treat these as separate environments:
- Local development PostgreSQL.
- CI disposable PostgreSQL.
- Render production PostgreSQL.
- Vercel production Flutter Web.
- Render production backend.

Never copy production secrets into local files, CI fixtures, `.ai`, tests, or source control.

## 3. Runtime credential contract
### Application
`DATABASE_URL` must identify `erp_app`.
`erp_app` must remain LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS and must not have platform lifecycle procedure EXECUTE privilege.

### Platform procedures
`PLATFORM_DATABASE_URL` must identify `erp_platform_executor`.
`erp_platform_executor` may execute only explicitly approved platform procedures and must not receive broad table/sequence privileges.

### Security bootstrap
`PLATFORM_SECURITY_DATABASE_URL` is operator-only.
It must never be configured on the Render web service or included in application runtime configuration.

## 4. Local deployment
Use:
```powershell
npm run db:diagnose
./scripts/start-local-dev.ps1
```
Do not invent database names, roles, passwords, or fallback databases.

## 5. CI deployment validation
For database/security changes, require:
- migration from a clean PostgreSQL database;
- platform-security bootstrap;
- role attribute checks;
- membership checks;
- RLS/FORCE RLS checks;
- application table/sequence privilege checks;
- SECURITY DEFINER function owner/search_path/EXECUTE checks;
- backend typecheck/lint/build;
- unit tests;
- PostgreSQL integration tests;
- Flutter validation when frontend deployment boundaries are affected;
- Docker build/security scan when the backend image is affected.

Do not declare deployment readiness from source-code review alone.

## 6. Vercel
Repository deployment contract:
- `vercel.json` owns the build command and SPA rewrite.
- `scripts/vercel-build.sh` owns Flutter SDK/build setup.
- `API_BASE_URL` is supplied by the Vercel environment and passed to Flutter with `--dart-define`.
- Vercel never connects directly to PostgreSQL.
- Vercel changes require frontend CI and a production/deployment build check.

Never hardcode production API credentials or database credentials into Flutter source.

## 7. Render
Repository deployment contract:
- `render.yaml` defines the backend service shape.
- `Dockerfile` defines the production image.
- `scripts/render-start.sh` defines runtime startup guardrails.
- Render web startup does not run migrations or privileged security bootstrap.
- `DATABASE_URL` and `PLATFORM_DATABASE_URL` are runtime credentials.
- `PLATFORM_SECURITY_DATABASE_URL` is prohibited at runtime.
- health validation must use `/api/v1/health/live`.

When Render provider state is inspected, distinguish provider-managed owner state from ERP application-role state.

## 8. Database migration safety
Before changing a migration or role policy:
1. Determine which role actually owns/creates the affected objects in each environment.
2. Determine whether the migration runs as `erp` or a provider-managed owner.
3. Verify `pg_default_acl` for the actual object-creating role.
4. Verify current table/function ownership.
5. Verify `erp_app` privileges on existing objects.
6. Verify the next migration will preserve those privileges.
7. Run clean PostgreSQL integration tests.
8. Do not transfer production ownership merely to make a test pass.

A mismatch between intended and actual object ownership is a deployment drift finding and must be recorded explicitly.

## 9. Production change sequence
```text
Code change
  ↓
Documentation/ADR impact review
  ↓
CI validation
  ↓
Database migration/operator preparation
  ↓
Production DB validation
  ↓
Render deployment
  ↓
Vercel deployment
  ↓
Health check
  ↓
Authentication smoke test
  ↓
Targeted business smoke tests
```
Database changes must be applied before an application version that depends on them, unless the migration is explicitly backward compatible.

## 10. Failure rules
Stop rather than weakening security when:
- `erp_app` becomes SUPERUSER or BYPASSRLS;
- platform executor gains table/sequence access;
- application roles gain platform procedure EXECUTE;
- procedure owner becomes LOGIN;
- SECURITY DEFINER search_path changes unexpectedly;
- production uses the privileged bootstrap credential at runtime;
- a migration requires an undocumented provider capability;
- live provider ownership differs from the documented intended owner and the safe ownership transition is undefined.

## 11. Required audit evidence
For every deployment/infrastructure change, record:
- environment;
- commit SHA;
- deployment ID where applicable;
- database migration state;
- role attributes;
- relevant memberships;
- object ownership;
- grants;
- RLS state;
- health result;
- authentication smoke-test result;
- unresolved provider-specific drift.

Do not claim green deployment evidence without actual provider/CI evidence.
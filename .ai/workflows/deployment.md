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

### Database provisioning
Read `.ai/contracts/database-provisioning.md` before any database/deployment change.

The canonical deployment operation is `npm run db:provision`. It must execute preflight, all journaled migrations, platform security/RLS bootstrap, platform administrator bootstrap, and final verification in that order.

Credential boundaries:
- `DB_PROVISIONING_DATABASE_URL`: privileged provisioning/security operator only.
- `DB_MIGRATION_DATABASE_URL`: migration/object-creating role.
- `DATABASE_URL`: runtime application connection.

The provisioner must verify that all three URLs target the same database. Never put the provisioning credential in the web runtime.

## 4. Local deployment
Use:
```powershell
npm run db:diagnose
./scripts/start-local-dev.ps1
```
Do not invent database names, roles, passwords, or fallback databases.

## 5. CI deployment validation
For database/security changes, require:
- clean PostgreSQL provisioning through `npm run db:provision`;
- idempotent rerun against the same database;
- migration journal verification;
- role attribute and membership checks;
- RLS/FORCE RLS checks;
- application table/sequence privilege checks;
- SECURITY DEFINER function owner/search_path/EXECUTE checks;
- platform administrator bootstrap verification;
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
- `render.yaml` defines the backend service shape and uses `autoDeployTrigger: checksPass`.
- `Dockerfile` defines the production image and includes compiled migration assets.
- `scripts/render-start.sh` starts the application only.
- `DB_PROVISIONING_DATABASE_URL` and `DB_MIGRATION_DATABASE_URL` are deployment-stage credentials and must never be runtime credentials.
- `DATABASE_URL` identifies `erp_app`.
- `PLATFORM_DATABASE_URL` identifies `erp_platform_executor`.
- health validation uses `/api/v1/health/live`.

### Current Free Render deployment gate
The current Render web service is Free and therefore cannot use Render's native pre-deploy command. The repository uses an external deployment-stage gate instead:

```text
Git push to main
  ↓
GitHub CI checks
  ↓
production-provision check waits for the other commit checks
  ↓
npm run db:provision:compiled
  ↓
Render configured as "After CI Checks Pass"
  ↓
Render builds/deploys the exact commit
  ↓
/api/v1/health/live
```

The production provisioning workflow uses GitHub Actions secrets only:
- `PROD_DB_PROVISIONING_DATABASE_URL`
- `PROD_DB_MIGRATION_DATABASE_URL`
- `PROD_DATABASE_URL`
- `PROD_PLATFORM_ADMIN_USERNAME`
- `PROD_PLATFORM_ADMIN_PASSWORD`
- `PROD_PLATFORM_ADMIN_EMAIL`

These secrets must never be copied into Render runtime environment variables.

On paid Render web services, the same canonical compiled provisioner may instead run as the native pre-deploy command. The provider-independent provisioning contract does not change.

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
Production database provisioning
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

Database changes must be applied before an application version that depends on them.

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

## 12. Migration journal and provider application rule
The migration source of truth is the combination of:
- `src/infrastructure/database/migrations/*.sql`
- `src/infrastructure/database/migrations/meta/_journal.json`
- `src/infrastructure/database/migrate.ts`

A new SQL migration is **not deployable merely because the .sql file exists**. Every new migration must be registered in `_journal.json`, and its tag must resolve to an existing SQL file. Run the repository migration runner against the target database and verify the resulting database state.

Render production must never rely on web-service startup to run migrations or privileged security bootstrap. On the current Free service, the production GitHub Actions gate is the deployment-stage mechanism. Render is configured to deploy only after CI checks pass, so the database provisioning check completes before the application commit is deployed. On paid Render, use the native pre-deploy command instead.

Local/self-hosted deployment uses the same migration runner: `npm run db:migrate`. Therefore a correctly journaled migration will be applied locally when the local database is migrated. Existing databases must also be checked for drift because deployment behavior depends on their actual migration history and schema state.

### Required pre-deployment checklist for database changes
1. Add the SQL migration.
2. Register the migration in `_journal.json`.
3. Confirm `migrate.ts` discovers and applies it.
4. Run clean PostgreSQL migration/integration tests.
5. Ensure production provisioning credentials are available only as GitHub Actions secrets.
6. Provision the target production database before application deployment.
7. Inspect the live target policy/schema state.
8. Deploy the application.
9. Perform authentication and targeted smoke tests.
10. Record migration state and provider-specific evidence.

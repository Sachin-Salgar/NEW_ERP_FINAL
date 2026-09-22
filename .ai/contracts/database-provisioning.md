# Database Provisioning Contract

**Status:** Canonical  
**Scope:** Local PostgreSQL, CI PostgreSQL, Render PostgreSQL, and other supported PostgreSQL deployments.

## Principle

A PostgreSQL database is not considered ERP-ready until the canonical provisioning pipeline completes successfully.

The single supported orchestration entry point is:

```text
npm run db:provision
```

For compiled deployment images:

```text
npm run build
npm run db:provision:compiled
```

The provisioner is provider-independent. Render, local PostgreSQL, CI, and other PostgreSQL providers may supply different connection URLs and credentials, but they must execute the same repository provisioning flow.


## Migration journal contract

Every SQL file directly under `src/infrastructure/database/migrations/` is a canonical migration and **must** have a matching entry in `migrations/meta/_journal.json`. The provisioner now validates this invariant before applying migrations and fails closed if an SQL migration is orphaned from the journal. Adding a new migration therefore requires updating both the SQL file and the journal in the same change.

## Credential boundaries

The provisioner receives three explicitly separated connections:

- `DB_PROVISIONING_DATABASE_URL`: privileged operator connection. Used only to apply the database security/RLS bootstrap and verify database state.
- `DB_MIGRATION_DATABASE_URL`: object-creating migration role, normally `erp`. Migrations must execute as the intended migration/object-creating role.
- `DATABASE_URL`: runtime application connection. Used by the platform administrator bootstrap and later by the application as `erp_app`.

The privileged provisioning connection must never be supplied to the running web application.

`PLATFORM_SECURITY_DATABASE_URL` is legacy configuration and must not be used by the canonical provisioning pipeline.

## Canonical sequence

```text
Preflight
  ↓
Verify all three endpoints target the same PostgreSQL database
  ↓
Run all journaled migrations
  ↓
Run platform security/RLS bootstrap
  ↓
Bootstrap/verify the initial platform administrator
  ↓
Verify migration state, roles, platform membership, and RLS
  ↓
DATABASE READY
```

A failed step stops provisioning. The backend must not be promoted as ready after a failed provisioning step.

## Platform administrator password contract

`PLATFORM_ADMIN_PASSWORD` is authoritative only when the platform administrator is being created, or when the operator explicitly sets:

```text
PLATFORM_ADMIN_RESET_PASSWORD=true
```

Normal idempotent provisioning must **not** silently replace an existing administrator password merely because `PLATFORM_ADMIN_PASSWORD` is present in the environment.

The reset flag is a deliberate recovery/development control. It must be returned to `false`/unset after the one-shot reset and must not be enabled as a permanent production behavior.

A password reset is performed transactionally and is recorded in the platform audit event metadata without recording the password itself.

## Idempotency

Provisioning must be safe to run repeatedly:

- Applied migrations are skipped by the migration journal.
- Platform security bootstrap converges on the declared role/grant/RLS contract.
- Platform administrator seed is idempotent and must not overwrite an existing administrator password unless the explicit reset control is enabled.
- Verification is repeatable.
- Provisioning must never delete ERP business data as part of normal execution.

## Fresh database guarantee

A clean PostgreSQL database must be able to reach the same final schema/security state by running the canonical pipeline. Required database roles, permissions, RLS, lifecycle functions, platform configuration, and initial platform administrator must all be represented by repository-controlled provisioning code.

## Deployment boundary

The web start script is currently also the deployment-stage boundary because the project is on the Free Render plan and native Render pre-deploy is unavailable.

For the current development deployment, `scripts/render-start.sh` runs:

```text
node dist/infrastructure/database/provision.js
  ↓
node dist/main.js
```

The minimal runtime image intentionally contains Node.js but not npm. Render startup therefore invokes the compiled provisioner directly with `node`; `npm run db:provision:compiled` remains the local/standard command, not the runtime-image command.

Provisioning must complete successfully before the application starts. A provisioning failure stops the container and therefore prevents the application from serving traffic.

This is an intentional development-stage exception: `DB_PROVISIONING_DATABASE_URL` and `DB_MIGRATION_DATABASE_URL` are supplied to the Render service so the startup deployment stage can execute the canonical provisioner. These credentials must not be retained in a real production web runtime.

## AI implementation rules

AI agents must:

1. Read this contract before database/deployment changes.
2. Inspect the actual migration journal and provisioning code before adding a new SQL file.
3. Never invent a missing migration, role, permission, or provider capability.
4. Never use `drizzle-kit push` as a production deployment mechanism.
5. Never grant DDL privileges to `erp_app` to make provisioning pass.
6. Never place the privileged provisioning URL in application runtime configuration.
7. Never move provisioning back into an ad-hoc application startup path outside the documented Free Render development exception.
8. Remember that the Render minimal runtime image has no npm; invoke the compiled provisioner with `node dist/infrastructure/database/provision.js`.
9. Treat `PLATFORM_ADMIN_PASSWORD` as initial-bootstrap input, not an implicit password-reset command.
10. Use `PLATFORM_ADMIN_RESET_PASSWORD=true` only for an intentional one-shot recovery/reset, then return it to false/unset.
11. Test the clean-database path in CI before declaring database architecture green.
12. Test the existing-database/idempotent path.
13. Update this contract and the authoritative DevOps/security documents when the provisioning architecture changes.

## Source of truth

Implementation:

- `src/infrastructure/database/provision.ts`
- `src/infrastructure/database/migrate.ts`
- `src/infrastructure/database/platform-security-bootstrap.ts`
- `src/infrastructure/database/platform-security.ts`
- `src/infrastructure/database/platform-admin-seed.ts`
- `scripts/platform-security.sql`

Authoritative architecture:

- `docs/07-devops/01-deployment-architecture.md`
- `docs/07-devops/12-current-deployment-topology.md`
- `docs/03-database/16-security-architecture.md`

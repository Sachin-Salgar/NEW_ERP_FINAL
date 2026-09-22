# Deployment and Database Role Audit — 2026-09-21

## Executive result
The application is currently operational in production. Vercel serves the Flutter Web client, Render serves the Dockerized Fastify backend, and Render PostgreSQL supplies the database.

The deployment security boundary is substantially implemented and CI is green. The audit identified **documentation/deployment-state drift**, not a reason to weaken the current runtime security model.

## Verified
- GitHub default branch is `main`.
- Render web service is `NEW_ERP_FINAL`, Docker runtime, Singapore, auto-deploying from `main`.
- Render PostgreSQL is PostgreSQL 18, database `erp_database_c17z`, provider owner `erp_user`.
- Vercel repository configuration builds Flutter Web with `API_BASE_URL` and uses an SPA rewrite.
- Production login through `https://erp.salgar.in` was verified after correcting CORS and application-table privileges.
- `erp_app` has CRUD privileges on authentication tables required for login.
- `erp_app` is NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS.
- `erp_platform_executor` is login-capable but has no broad table privileges.
- `erp_procedure_owner` is NOLOGIN and non-superuser.
- Provider-managed `erp_user` memberships exist and are intentionally treated separately from application-role membership validation.
- GitHub CI, PostgreSQL integration, AI workflow validation, and Vercel checks were green for commit `46bc4c2d26179de4a79a79be0ea82c42c215df67`.

## Findings
### D-01 — Render object ownership differs from intended migration-role documentation
The live Render database shows application tables owned by `erp_user`, while the repository architecture describes `erp` as the migration/object-creating role.

**Disposition:** Documented drift. Do not transfer ownership automatically.

Before the next production schema migration, determine whether Render permits the intended `erp` migration path and whether an explicit ownership migration is required. This must be a controlled operator decision, not an application-startup change.

### D-02 — Render provider owner memberships are expected but must remain isolated
`erp_user` is a provider-managed database owner and is a member of the four ERP roles. The bootstrap verifier excludes the current database owner from the application-role membership normalization rule.

**Disposition:** Retain. Do not revoke provider-managed ownership memberships through application startup.

### D-03 — Existing application grants were repaired manually during production incident
A one-time operator GRANT restored `erp_app` access to current tables and sequences after the production deployment exposed missing authentication-table privileges.

**Disposition:** Keep the security bootstrap as the convergence mechanism and require the production migration/operator procedure to run it after schema changes. Future deployment automation should explicitly verify grants before application rollout.

### D-04 — Default-privilege behavior requires environment-specific verification
The source security architecture discusses default privileges for `erp`, while the current live Render catalog did not show public-schema default ACL entries for `erp` or `erp_app`.

**Disposition:** Do not infer future-object safety from documentation. Before the next schema migration, verify the actual object-creating role and its default privileges. CI remains the clean-database proof.

### D-05 — Provider-specific deployment is now real, not hypothetical
The repository previously described the final provider as unselected. Production is now concretely Vercel + Render.

**Disposition:** The current topology is recorded in `docs/07-devops/12-current-deployment-topology.md`. The architecture remains provider-portable; provider-specific deployment behavior is documented separately.

## Required operating rule
The live production system must not be fixed by changing runtime roles or disabling RLS. Deployment drift must be corrected through migration/operator procedures with CI evidence.

## Next audit checkpoint
Before the next production schema-changing release:
1. Verify migration/object-creating role.
2. Verify default privileges for that role.
3. Verify ownership and grants on new objects.
4. Run the complete PostgreSQL integration suite.
5. Apply migration in production through the operator path.
6. Run platform-security verification.
7. Deploy Render backend.
8. Verify Vercel frontend/API connectivity.
9. Perform authentication and targeted business smoke tests.
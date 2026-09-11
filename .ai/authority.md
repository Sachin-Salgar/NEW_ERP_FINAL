# AI Authority Contract

## Purpose

Define which repository information an AI coding assistant may rely on when understanding or changing NEW_ERP_FINAL.

## Authority hierarchy

Use the repository's governance hierarchy exactly as defined by `docs/00-overview/02-governance.md`:

1. **Software Architecture Document (SAD)** — baseline architectural guidance.
2. **Approved ADRs** — supersede affected SAD decisions within their explicit scope.
3. **Development Standards** — implementation standards that operationalize architecture.
4. **Module Specifications** — module-specific application of the higher-level rules.
5. **Source code and tests** — evidence of current implementation, not architectural authority.
6. **AI inference** — lowest authority and never sufficient to override repository evidence.

## Current Tenancy Authority

`docs/10-adr/0040-platform-identity-membership-and-context.md` is the approved
architectural authority for Platform, Tenant, Branch, authentication, platform
administration, deployment, and RLS boundaries.

The current hierarchy is:

```text
Platform
  └── Tenant
       └── Branch
            ├── Users
            ├── Roles
            └── Data
```

The ERP is multi-tenant at the platform level. Tenant is the security, authorization,
and data-isolation boundary. A normal application user belongs to exactly one tenant,
and normal login establishes that tenant automatically. Tenant switching and
multi-tenant user context selection are not supported. Branch is a business
subdivision inside a tenant and is not another security tenant. Organisation and
Location are not current architecture levels.

### Authentication / working-context UX contract

- The configured API URL is connectivity configuration only and is never tenant authority.
- Credential verification establishes the user's single tenant context automatically.
- Normal login does not show a tenant selector and does not support tenant switching.
- Branch access is evaluated only where a domain operation requires branch distinction.
- Working-context changes cannot change the authenticated tenant.
- Web and mobile clients connect to the configured ERP backend endpoint and never directly to PostgreSQL.
- Deployment URL/API endpoint is connectivity configuration only. Hostname, custom domain, deployment configuration, or client-supplied tenant identifiers must not be treated as authoritative tenant identity.

For platform work, the canonical security lifecycle is:

```text
Authenticated Identity
  ↓
Platform Membership
  ↓
Platform-scoped Session
  ↓
Platform Permission
  ↓
Dedicated Platform Executor / Approved Procedure
```

### Platform administration boundary

The approved operator bootstrap is `npm exec tsx scripts/platform-admin.ts bootstrap <email>`.
It creates the first identity, local credential, active platform membership, protected
`platform_owner` role assignment, and platform audit event. The custom tenant seed does
not create a platform administrator; it creates tenant users and tenant memberships.
Platform recovery is the separate operator-only `recover` command.

Platform administration is a distinct platform context with separate platform
membership, session, permissions, bootstrap, and audit rules. It does not change the
normal user's single-tenant application model.

## Document status

- `Approved` ADR: authoritative for its stated scope.
- `Proposed` ADR: not an implementation authority.
- `Superseded` ADR: not authoritative; follow its replacement.
- `Deprecated` ADR: not authoritative for new implementation.
- `docs/archive/`: historical/reference material; do not treat its contents as current authority unless a current authoritative document explicitly directs its use.

## Conflict rules

### Architecture vs code

If authoritative documentation conflicts with source code, treat the source code as non-conforming implementation. Do not silently change the documentation to match the code.

### SAD vs ADR

An approved ADR wins only for the decision and scope it explicitly addresses. It does not globally invalidate unrelated SAD requirements.

### Standards vs architecture

Development standards clarify how to implement architecture. They may not silently contradict higher-level architectural decisions.

### Missing decision

If a feature requires a decision that the authoritative documentation does not establish, do not invent it. Report the missing decision and stop at the decision boundary.

### Contradictory documents

If two apparently authoritative documents conflict and the conflict cannot be resolved from an approved ADR or governance rule, stop and report the conflict. Do not select one by preference.

## Database infrastructure rule

Database infrastructure is developer-owned. AI agents must never create, modify, delete, replace, or provision PostgreSQL databases, PostgreSQL users, or PostgreSQL roles. AI agents must never invent database credentials or connection strings. AI agents must use the project's documented environment configuration and must fail clearly when the configured database is unavailable.

A database connection failure is NOT permission to create another database, create another user, change credentials, or switch to Docker PostgreSQL.

## Local PostgreSQL access contract

- Local PostgreSQL credentials are supplied through the uncommitted `.env.local`; never commit it or copy its values into `.ai`, logs, tests, or documentation.
- Inspect the repository configuration loader before diagnosing access. `DATABASE_URL` is the application connection, while `TEST_DATABASE_URL` is the explicit integration-test target.
- Integration setup requires an administrative connection for migrations and security bootstrap. Locally it may use the existing `PGHOST`, `PGPORT`, `PGUSER`, and `PGPASSWORD` variables; CI supplies its own administrative `DATABASE_URL` and test credentials.
- Integration security-role setup uses `ADR0040_SECURITY_ROLE_PASSWORD` when explicitly configured, otherwise its documented test-only fallback; the application pool receives that provisioned role password, not an unverified application URL password.
- The standard integration application pool uses the role and password from `TEST_DATABASE_URL`; tests that explicitly prove the `erp_app` security boundary provision and connect to that role in their isolated fixture. Platform operations use the separately provisioned platform executor boundary.
- Do not invent credentials, switch databases, weaken PostgreSQL authentication, or provision roles/databases. Use the repository configuration path and `npm run db:diagnose` for sanitized diagnostics.
- Before reporting authentication failure, confirm `.env.local` loading, identify whether `DATABASE_URL` or `TEST_DATABASE_URL` was used, verify PostgreSQL availability, run migrations/security setup when required, and rerun the targeted test. Never print passwords or full connection strings.
- CI and production credentials are independent from developer credentials and must never be copied into local configuration or `.ai`.

## PostgreSQL role / RLS testing trust boundary

Database administrative/setup connections and application/RLS connections are separate trust levels:

- `postgres` (or another configured administrative role) is for database creation/reset, schema and migration administration, role configuration, genuinely privileged fixture setup, and privileged cleanup only.
- `erp_app` is the non-privileged application/RLS role. Protected application queries and integration-test operations that prove tenant isolation, RLS/FORCE RLS, tenant-context enforcement, cross-tenant prevention, NULL-context fail-closed behavior, or authorization interacting with RLS MUST execute through `erp_app`.
- `erp_platform_executor` is the platform/security execution role for its explicitly granted procedures.
- `erp_procedure_owner` is the procedure ownership/security-definer boundary where applicable.

`erp_app` MUST remain `rolsuper = false` and `rolbypassrls = false`. A test connected as a PostgreSQL superuser is not evidence that RLS works. Tests must not make RLS tests pass by using an administrative role for application queries, disabling RLS or FORCE RLS, weakening policies or security predicates, granting `BYPASSRLS`, or bypassing tenant context. Administrative fixture creation and application/RLS verification must remain explicitly separated.

Tenant context must be established on the same PostgreSQL session/connection that executes the protected operation. Connection pooling must not leak tenant context between tenants or tests. When an RLS test fails, first verify that the protected operation is running as `erp_app` with the expected tenant context. Do not classify a failure as pre-existing without a controlled baseline/current comparison. Future agents modifying integration tests MUST preserve this role separation.

## AI evidence requirements

For every non-trivial implementation task, the AI should be able to state:

- authoritative documents consulted;
- approved ADRs consulted;
- existing implementation inspected;
- tests inspected;
- unresolved ambiguities;
- validation performed after the change.

## Implementation-progress authority (roadmap)

- The living implementation roadmap `docs/00-overview/03-implementation-roadmap.md` is the authoritative source of project implementation state and the IMMEDIATE NEXT STEP for AI sessions.
- AI must consult the roadmap at session start and obey the IMMEDIATE NEXT STEP unless the user explicitly overrides it.
- Do not mark a roadmap step complete based solely on code presence. A step is complete only when the roadmap marks it COMPLETE and records validation evidence.

## Roadmap update requirement

After every meaningful implementation step the AI MUST update `docs/00-overview/03-implementation-roadmap.md` with status, implementation summary, files changed, tests run, validation results, evidence references, remaining risks, and the IMMEDIATE NEXT STEP.

The AI must not declare a step COMPLETE until the roadmap is updated with validation evidence and the roadmap shows the step as COMPLETE.

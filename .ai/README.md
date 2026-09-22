# NEW_ERP_FINAL AI Development System

This directory contains repository-aware AI workflow artifacts. It is **not** a second source of truth for ERP architecture.

## Source of truth

The authoritative ERP definition remains under `docs/` according to the governance and decision hierarchy defined by:

- `docs/README.md`
- `docs/00-overview/02-governance.md`
- `docs/10-adr/README.md`

For identity, tenancy, platform administration, deployment boundary, and RLS work, the
approved decision is `docs/10-adr/0040-platform-identity-membership-and-context.md`.
ADR-0006 is a superseded historical decision and must not guide current implementation.
ADR-0010, ADR-0011, and ADR-0012 are current approved architecture decisions for
Tenant module entitlement, Tenant/Branch context, and Branch access representation.

AI workflow files in `.ai/` explain **how an AI coding assistant should navigate, reason about, implement, and validate changes in the repository**.

## Core layers

### 1. Authority

- `authority.md` — authority and conflict-resolution rules for AI.

### 2. Repository navigation

- `repository-map.md` — stable navigation map of repository domains.
- `generated/` — optional deterministic scanner output; derived facts only.

### 3. Workflows

- `workflows/feature-development.md` — mandatory feature-development lifecycle.
- `workflows/repository-maintenance.md` — scanner/index maintenance lifecycle.

### 4. Canonical Workflow/BPM operating rule

- `workflows/canonical-workflow-bpm.md` — mandatory AI operating rule for the single canonical Workflow/BPM engine. Workflow owns configurable approval/process orchestration; business modules own business state and invariants.

### 5. Deterministic tooling

- `tools/ai/repository_scanner.py` — inventories repository structure and lightweight documentation metadata without an LLM.
- `tools/ai/validate_ai_workflow.py` — validates that the AI workflow contract and required authority entry points exist.

## Fundamental rules

1. `docs/` is the ERP source of truth.
2. `.ai/` is workflow/navigation, not ERP architecture.
3. `.github/` connects the workflow to GitHub Copilot.
4. The scanner reports facts; it does not decide architecture.
5. AI must discover and use the smallest relevant set of authoritative documents and implementation files for each task.
6. AI must inspect actual source files before relying on generated inventory for implementation decisions.
7. AI must not pretend that it has read the entire repository.
8. When required information is missing or contradictory, AI must stop and ask instead of inventing a decision.
9. A feature is not complete until applicable validation has actually run and passed.
10. Deployment URL/API endpoint is connectivity configuration only; it is not authoritative tenant identity.
11. The ERP is multi-tenant at the platform level. Tenant is the security, authorization, and data-isolation boundary.
12. A normal application user belongs to exactly one tenant. Normal login establishes that tenant automatically; tenant switching and multi-tenant user context selection are not supported.
13. Branch is the only business subdivision below Tenant. Branch is not a security tenant. Organisation and Location are not current architecture levels.
14. Platform administration remains a distinct platform context with separate authorization.
15. PostgreSQL RLS remains mandatory for tenant-owned data.

### Platform administration and module entitlement contract
- All platform-administration data reads and writes must execute through `platformExecutor(request)` (the platform database executor), not the tenant/runtime `dbPool`, because platform-context RLS is distinct from tenant context. This applies to platform members, roles, permissions, security policy, and audit APIs as well as tenant module entitlements.
- Platform authorization itself (`validateContext`, `hasPermission`, and platform tenant listing) must also use the dedicated platform executor connection. Decorating `platformDbPool` after application construction is not sufficient; services created during application construction must receive the platform pool explicitly.
- `tenant_modules` is FORCE RLS. Platform module reads/writes must run in an executor transaction with `app.current_tenant_id` set to the target tenant; never grant `BYPASSRLS` merely to make platform administration work. Platform audit reads/writes must set `app.platform_audit_enabled=true` in the same transaction because `audit_events` is FORCE RLS.
- Platform bootstrap/migrations must be idempotent and synchronize the protected `platform_owner` role with the complete canonical platform permission set, including `platform.modules.manage`, so upgrades repair older installations.

- Platform context is separate from tenant context and uses platform permissions.
- Platform Administration is the authoritative UI and API surface for tenant lifecycle, tenant module entitlement, platform members, platform roles, security policy, and platform audit.
- Tenant module entitlement is authoritative in `tenant_modules`, keyed to the canonical `modules` catalog. The frontend must never maintain a second hard-coded entitlement catalog.
- Platform module management uses the platform-context API `/api/v1/platform/tenants/:tenantId/modules` and `/api/v1/platform/tenants/:tenantId/modules/:code`.
- Core modules (`modules.is_core = true`) cannot be disabled.
- Business-module access is two-layered: tenant entitlement first, then tenant-user permission. A UI toggle never replaces backend authorization.
- Platform module changes must be auditable as platform-context events and must preserve tenant isolation.
- Platform roles and permissions are separate from tenant RBAC. The protected system platform owner role is seeded from the canonical platform permission catalog.
- Do not call tenant-only `/auth/modules` endpoints while the frontend is in platform context.
- `/auth/me` is context-aware: platform sessions must be validated through platform authorization; tenant sessions use tenant authentication.
- API token refresh logic must explicitly exclude the refresh endpoint to avoid recursive refresh behavior.

### Local database workflow

Local PostgreSQL credentials live in the uncommitted `.env.local` and must never be committed or copied into `.ai`. Agents must inspect the loader in `src/config/schema.ts` and integration setup before diagnosing access. `DATABASE_URL` is the application database; `TEST_DATABASE_URL` is the explicit integration-test database. Integration setup uses local `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD` administrative variables when present, while CI provides separate workflow credentials. Use `npm run db:diagnose` for sanitized source, endpoint, role, password-presence, and connectivity diagnostics. Never print passwords or full URLs, invent credentials, weaken PostgreSQL authentication, or make production depend on local credentials.

Required order: read this contract; inspect configuration loading; confirm `.env.local` exists without exposing contents; determine sanitized effective configuration; verify connectivity; run migrations and security/bootstrap; run the targeted integration test; only then report a database authentication failure.

## Implementation-progress authority

`docs/00-overview/03-implementation-roadmap.md` is the authoritative project-state document for what has been implemented, what is being refactored, and what must be done next.

AI sessions MUST consult the roadmap at session start and obey its IMMEDIATE NEXT STEP unless the user explicitly instructs otherwise.

During the identity-based tenant migration, the roadmap is intentionally reconciled as a clean implementation plan: retained foundations are marked COMPLETED, affected legacy tenant-resolution work is marked for REFACTOR, and new migration steps become COMPLETED only after implementation and validation evidence exists.

## Session initialization (MANDATORY)

At the beginning of every AI implementation session the agent must perform the following read-only sequence before making changes:

1. Run `git status --short --untracked-files=all` and record working-tree status.
2. Identify the current branch and recent commits relevant to the active work.
3. Read `.ai/workflows/feature-development.md` and `.ai/workflows/ai-system.md` to re-establish local workflow rules.
4. Read `docs/00-overview/03-implementation-roadmap.md` and extract CURRENT IMPLEMENTATION CHECKPOINT and IMMEDIATE NEXT STEP.
5. Use `.ai/authority.md` to determine which authoritative documents apply to the active step.
6. For tenancy/authentication/platform work, read ADR-0040 and the affected database,
   backend, security, frontend, and deployment documents before implementation. Read
   superseded ADRs only to understand historical rationale.

The agent must not start implementation until it can answer: "What exact roadmap step am I implementing?"

## Session checkpoint format

Agents should create an ephemeral checkpoint containing:

- CURRENT SLICE:
- CURRENT STEP:
- STATUS:
- AUTHORITATIVE DOCS:
- IMPLEMENTATION TARGET:
- VALIDATION REQUIRED:
- KNOWN BLOCKERS:
- IMMEDIATE NEXT STEP:

This checkpoint is ephemeral and must not duplicate roadmap state.

## Local validation commands

From the repository root:

```text
python tools/ai/validate_ai_workflow.py
python tools/ai/repository_scanner.py
```

The first command validates the workflow contract. The second refreshes deterministic repository context.

### Canonical database provisioning

`.ai/contracts/database-provisioning.md` is the mandatory AI contract for database initialization, migration, security bootstrap, platform-admin bootstrap, and deployment database readiness.

The only supported database orchestration entry point is:

```text
npm run db:provision
```

Compiled deployment images use `npm run db:provision:compiled`.

The canonical pipeline is:

```text
preflight
  → migrations
  → security/RLS bootstrap
  → platform administrator bootstrap
  → final verification
  → database ready
```

The three credential boundaries are explicit:
- `DB_PROVISIONING_DATABASE_URL`: privileged provisioning/security connection.
- `DB_MIGRATION_DATABASE_URL`: object-creating migration role, normally `erp`.
- `DATABASE_URL`: runtime application connection, normally `erp_app`.

The privileged provisioning credential must not be exposed to the web runtime in real production. The current Free Render development deployment intentionally supplies it to the startup deployment stage because native pre-deploy is unavailable; this exception must be removed before real production.

Manual sequences of migration/security/seed commands are not supported. AI must not reintroduce them.

Render deployment mode is environment-specific. On the current Free Render development service, `scripts/render-start.sh` runs the canonical provisioner first and starts the application only after provisioning succeeds. This intentionally exposes deployment credentials during startup for development only. On paid Render, move the provisioner to native pre-deploy; on self-hosted production, run it in the isolated deployment pipeline. Remove privileged provisioning credentials from the web runtime before real production.

A database is not green until the canonical provisioner has completed and verification has passed. A successful Docker build or backend health check alone is insufficient.

Before database/deployment implementation, read `.ai/contracts/database-provisioning.md` and the authoritative DevOps/security documents.

## Platform navigation contract

Platform-context sessions are separate from tenant navigation. In platform context, the main application sidebar exposes Platform Administration and does not expose tenant Settings. The platform route is /platform. If a platform session reaches /dashboard or any /settings URL, including after browser refresh or deep-link navigation, the router redirects it to /platform. Tenant sessions continue to use normal Dashboard and Settings navigation; tenant Settings remains branch-aware.

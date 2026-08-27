# Implementation Roadmap — Identity-Based Tenant Baseline

**Status:** ACTIVE  
**Baseline:** 2026-08-27  
**Authority:** This document records the current implementation state. Architecture is governed by `docs/` and approved ADRs.

## Current Checkpoint

**Slice:** Core platform / authentication / tenancy  
**Current step:** TENANT-REFactor-07 — CI validation and stale-architecture audit  
**Status:** IN PROGRESS

The repository is being reconciled to one canonical tenant model: deployment endpoint identifies the ERP backend; authenticated identity establishes the tenant; the tenant-scoped session establishes `TenantContext`; PostgreSQL RLS enforces database isolation.

## Architecture Baseline

```text
Web / Mobile Client
       │
       │ configured ERP API URL
       ▼
ERP Backend
       │
       │ login identifier + password
       ▼
Deployment-independent identity lookup
       │
       ▼
Tenant-scoped user account
       │
       ▼
Tenant-scoped session
       │
       ▼
TenantContext
       │
       ▼
Authorization
       │
       ▼
Tenant-scoped DB transaction
       │
       ▼
SET LOCAL app.current_tenant_id
       │
       ▼
PostgreSQL RLS
```

Deployment URL, hostname, Vercel URL, on-premises URL, and client-supplied tenant identifiers are **not** tenant authority.

## Reconciliation Ledger

### TENANT-REFactor-01 — Archive boundary
**Status: COMPLETED**

- Previous implementation was preserved on the dedicated archive branch.
- Active work continues only on `refactor/auth-tenant-context`.

### TENANT-REFactor-02 — Architecture authority
**Status: COMPLETED**

- Approved ADR-0006 establishes identity-based tenant context and PostgreSQL RLS.
- Multi-tenancy, authentication, security, frontend deployment, and AI authority documents were reconciled.

### TENANT-REFactor-03 — Remove host/deployment tenant resolution
**Status: COMPLETED**

- Host/deployment resolver services and associated resolver tests were removed from the active architecture.
- Bootstrap is connectivity/capability metadata only.

### TENANT-REFactor-04 — Identity login lookup
**Status: COMPLETED — IMPLEMENTED**

- Added deployment-independent `auth_login_identifiers` persistence.
- Existing active user email identities are backfilled.
- User lifecycle trigger keeps the canonical email login identity synchronized.
- `IdentityAwarePostgresPlatformRepository` supplies candidate tenant/user identities.

### TENANT-REFactor-05 — Session tenant authority
**Status: COMPLETED — IMPLEMENTED**

- Authentication establishes the tenant from the authenticated tenant-scoped user account.
- `requireAuth` derives request tenant from the validated session.
- Organization selection validates access within the established tenant and cannot change tenant identity.
- Client-supplied tenant headers are not authoritative.

### TENANT-REFactor-06 — Frontend deployment model
**Status: COMPLETED — DOCUMENTED**

- Frontend configuration identifies the backend API endpoint only.
- SaaS uses the central API endpoint.
- On-premises web/mobile clients use the configured customer backend endpoint.
- Mobile never connects directly to PostgreSQL.

### TENANT-REFactor-07 — CI validation and stale-architecture audit
**Status: IN PROGRESS**

Required evidence:

- CI integration tests pass.
- Unit tests pass.
- Typecheck passes.
- AI workflow validation passes.
- RLS isolation, rollback, and connection-pool safety are verified.
- Repository-wide search finds no active host/deployment tenant resolver.
- Repository-wide search finds no client-authoritative tenant selection path.
- Frontend integration test no longer assumes host-based tenant discovery.

### TENANT-REFactor-08 — SaaS deployment validation
**Status: PENDING**

Validate the deployed frontend → deployed backend → PostgreSQL path using identity-based login. No tenant hostname mapping is required.

### TENANT-REFactor-09 — On-premises deployment validation
**Status: PENDING**

Validate a customer installation where frontend and backend are hosted on the customer's network. Confirm that web and mobile clients only need the backend API endpoint and that authentication discovers tenant identity from the account.

### TENANT-REFactor-10 — Final stale architecture removal
**Status: PENDING**

After validation, remove any remaining stale implementation, fixtures, documentation, generated AI context, or configuration that describes host/domain/deployment tenant resolution.

### TENANT-REFactor-11 — Final architecture completion audit
**Status: PENDING**

Complete an evidence-backed audit of architecture, source, tests, CI, security, deployment model, and `.ai` workflow. Only then close this migration and reopen the normal CORE/business-module roadmap.

## Retained Foundations

The following are retained and treated as completed foundations unless a validation gap is discovered:

- PostgreSQL shared-schema tenant isolation.
- `tenant_id` on tenant-owned entities.
- PostgreSQL RLS policies.
- tenant-scoped sessions.
- authentication and refresh-token lifecycle.
- RBAC and permission enforcement.
- organization/branch/location authorization within the active tenant.
- frontend permission-aware UX.
- repository-aware `.ai` workflow.

## Validation Gate

A migration step may be marked `COMPLETED` only after implementation, applicable automated tests, security validation, documentation reconciliation, and CI evidence are available.

## Do Not Start Yet

Business modules remain gated until TENANT-REFactor-11 passes:

- SALES
- PROCUREMENT
- INVENTORY
- FINANCE
- CRM
- MANUFACTURING

## AI Instruction

At every implementation session:

1. Read this roadmap.
2. Read `.ai/authority.md` and the applicable workflow files.
3. Read ADR-0006 before tenancy/authentication work.
4. Implement only the current step unless explicitly redirected by the project owner.
5. Update this roadmap with evidence after each meaningful step.
6. Never reintroduce host/domain/deployment tenant resolution as an alternative path.

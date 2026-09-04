# NEW_ERP_FINAL — Improvement Backlog

**Generated**: 2026-09-04  
**Last implementation synchronization**: 2026-09-04  
**Branch**: `feat/improvements`  
**Status**: Implementation backlog completed; runtime/provider/evidence validation remains where explicitly stated.

---

## Executive Summary

This document is the authoritative implementation status for the 32 improvements identified for the NEW_ERP_FINAL backend. The implementation pass on `feat/improvements` is now complete: there are no remaining **PENDING** or **PARTIAL** implementation items in this backlog. Items that require PostgreSQL extension availability, external providers, deployment credentials, production key material, worker operation, Docker/runtime execution, or product-policy decisions remain **IMPLEMENTED — VALIDATION PENDING** rather than being falsely marked verified.

The backend remains a Fastify/TypeScript modular monolith using PostgreSQL/Drizzle, JWT authentication, and PostgreSQL RLS tenant isolation. None of the improvement work weakens tenant isolation, RLS, authorization, authentication, transaction boundaries, or database integrity.

### Status rules

- **COMPLETED** — implementation is complete and sufficient prior validation evidence exists.
- **IMPLEMENTED — VALIDATION PENDING** — implementation is complete; VS Code/Copilot, CI, provider, deployment, or operational evidence is still required.
- **FUTURE — EVIDENCE REQUIRED** — intentionally not implemented because the approved architectural decision requires objective workload/data evidence first.

### Implementation closure

| Status | Count | Meaning |
|---|---:|---|
| COMPLETED | 18 | Implemented and already supported by sufficient prior verification evidence |
| IMPLEMENTED — VALIDATION PENDING | 13 | Implementation complete; validation/provider/deployment evidence remains |
| FUTURE — EVIDENCE REQUIRED | 1 | IMP-029 only; deliberately deferred by ADR |
| PARTIAL / PENDING | 0 | No remaining implementation backlog |

---

## P0 — Critical

### IMP-001 — OpenAPI/Swagger Documentation
**Status**: COMPLETED  
**Implementation**: `@fastify/swagger` and Swagger UI are integrated; `/docs` and `/docs/json` expose the generated OpenAPI contract for authentication, health, RBAC, organization/branch/location, enterprise, pagination, and error contracts. Prior runtime validation confirmed OpenAPI 3.0.3 generation.

### IMP-002 — Rate Limiting on Auth Endpoints
**Status**: COMPLETED  
**Implementation**: Fastify rate limiting protects login/register/refresh and account-security request paths with bounded windows and `Retry-After` behavior.

### IMP-003 — Request Validation Pipeline
**Status**: COMPLETED  
**Implementation**: Runtime schemas validate applicable bodies, parameters, query strings, and headers. Invalid inputs fail before business handlers and unsafe request casts have been substantially removed in favor of explicit route contracts and Zod parsing.

### IMP-004 — Audit Logging Foundation
**Status**: COMPLETED  
**ADR**: ADR-0014  
**Implementation**: Audit contracts, PostgreSQL persistence, append-only/RLS protection, correlation metadata, transaction reuse, and transactional enforcement are present. Prior local validation covered the audit logger and database/application transaction paths.

---

## P1 — High

### IMP-005 — Email Verification and Password Recovery
**Status**: IMPLEMENTED — PROVIDER VALIDATION PENDING  
**ADR**: ADR-0015  
**Implementation**:
- Cryptographically random hashed single-use tokens with expiry.
- Tenant-safe identity lookup for pre-auth recovery.
- Email verification request/confirm HTTP routes.
- Password recovery request/reset HTTP routes.
- Password-policy enforcement on reset.
- Session invalidation on password reset.
- Enumeration-resistant recovery response behavior.
- Provider-neutral notification queue adapter rather than raw-token persistence.

**Validation remaining**: Concrete external email/provider delivery in the target deployment.

### IMP-006 — MFA / TOTP
**Status**: IMPLEMENTED — DEPLOYMENT/PRODUCT VALIDATION PENDING  
**ADR**: ADR-0016  
**Implementation**:
- RFC 6238 TOTP implementation and vectors.
- AES-256-GCM protected TOTP secrets.
- Enrollment, confirmation, verify, recovery-code, and disable flows.
- Hashed one-time recovery codes and PostgreSQL persistence.
- HTTP routes are registered and protected.
- `MFA_ENCRYPTION_KEY` is part of validated configuration and production startup requirements.

**Validation remaining**: Production key provisioning and the separate product decision on whether MFA becomes mandatory during login.

### IMP-007 — Soft Delete Consistency
**Status**: COMPLETED  
**Implementation**: Repository filtering and regression coverage consistently exclude soft-deleted tenant records.

### IMP-008 — Enhanced Health Checks
**Status**: COMPLETED  
**Implementation**: Readiness/liveness, database connectivity/latency, pool state, uptime, and health details are implemented.

---

## P2 — Medium

### IMP-009 — Transaction Support / Unit of Work
**Status**: COMPLETED  
**Implementation**: `UnitOfWork`, AsyncLocalStorage transaction context, tenant-context transaction reuse, cross-tenant switching protection, service transaction boundaries, rollback behavior, and PostgreSQL integration coverage are present. Prior local validation passed the real PostgreSQL integration suite.

### IMP-010 — RFC 7807 Problem Details
**Status**: COMPLETED  
**Implementation**: `application/problem+json` representation supports `type`, `title`, `status`, `detail`, `instance`, and validation `errors`, while preserving the compatibility envelope for clients that do not opt in. Internal 5xx details are not exposed. Prior runtime validation passed.

### IMP-011 — Correlation ID Propagation
**Status**: COMPLETED  
**Implementation**: Correlation/request IDs are generated or propagated through AsyncLocalStorage and exposed consistently to logs, audit metadata, and HTTP responses.

### IMP-012 — `organization_modules` Schema Gap
**Status**: COMPLETED  
**Implementation**: Schema, migration registration, RLS-aware access, and migration-recovery governance are present.

### IMP-013 — Pagination on List Endpoints
**Status**: COMPLETED  
**Implementation**: Shared pagination uses `page`, `page_size`, `sort`, `order`, and `search`; RBAC and application list responses expose consistent metadata while legacy unpaginated behavior remains compatible when pagination parameters are absent. Current pagination is response-level; SQL/keyset optimization is a future performance optimization rather than an incomplete API contract.

---

## P3 — Platform Services

### IMP-014 — Notification Service
**Status**: IMPLEMENTED — PROVIDER VALIDATION PENDING  
**ADR**: ADR-0017  
**Implementation**: Provider-neutral contracts, PostgreSQL queue/history, tenant RLS, leasing, retry/backoff, worker foundation, and account-security notification integration are implemented.

**Validation remaining**: Deployment-specific email/SMS/push providers and operational delivery evidence.

### IMP-015 — File Storage Service
**Status**: IMPLEMENTED — PROVIDER VALIDATION PENDING  
**ADR**: ADR-0018  
**Implementation**: Provider-neutral storage contracts, tenant-scoped metadata, injected-provider orchestration, and authorization controls are implemented.

**Validation remaining**: Selection/configuration of the target storage provider and deployment evidence.

### IMP-016 — Scheduler Service
**Status**: IMPLEMENTED — OPERATIONAL VALIDATION PENDING  
**ADR**: ADR-0019  
**Implementation**: Durable job persistence, leasing, retry/backoff, and injected handlers are implemented.

**Validation remaining**: Worker/process execution in the chosen deployment topology.

### IMP-017 — Domain Events / Outbox
**Status**: IMPLEMENTED — OPERATIONAL VALIDATION PENDING  
**ADRs**: ADR-0008, ADR-0020  
**Implementation**: Versioned event contracts, tenant-RLS outbox persistence, dispatcher/worker foundation, lease/claim state, and modular-monolith-safe delivery are implemented without introducing an unnecessary external broker.

**Validation remaining**: Operational worker evidence and incremental adoption by future modules.

---

## P4 — Security Hardening

### IMP-018 — Account Lockout
**Status**: COMPLETED  
**Implementation**: Failed-attempt counting, configurable lockout duration, success reset, `423 Locked`, and `Retry-After` behavior are implemented.

### IMP-019 — Password Policy
**Status**: COMPLETED  
**Implementation**: Configurable length/uppercase/lowercase/number/symbol requirements are enforced in registration and password-reset/change paths; explicit boolean `false` values remain correctly parsed.

### IMP-020 — JWT Key Rotation / JWKS
**Status**: IMPLEMENTED — DEPLOYMENT VALIDATION PENDING  
**ADR**: ADR-0021  
**Selected algorithm**: RS256  
**Implementation**: Active/verification-only/retired key lifecycle, `kid`, JWKS endpoint, RS256 signing/verification, and opt-in legacy HS256 verification are implemented.

**Validation remaining**: Production signing-key provisioning and real rotation/runbook evidence.

### IMP-021 — Request Size Limits
**Status**: COMPLETED  
**Implementation**: Global Fastify body limit, tighter authentication-route limits, and `413` handling are present.

---

## Code Quality & Developer Experience

### IMP-022 — ESLint + Prettier
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Implementation**:
- Added ESLint 9 flat configuration in `eslint.config.mjs`.
- Added `.prettierrc.json` and `.prettierignore`.
- Added pinned quality-tool installation, lint, format, format-check, and aggregate quality scripts.
- Tool installation uses `--no-save --package-lock=false`, preserving the previously validated `npm ci` lockfile rather than hand-editing dependency metadata.
- Backend CI and release validation execute the lint quality gate.

**Validation remaining**: Execute the quality scripts in VS Code/Copilot/CI and address any repository-specific style findings they report.

### IMP-023 — Type-Safe Route Definitions
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Implementation**:
- Runtime Zod/JSON schemas remain the validation boundary.
- Major authentication, account-security, MFA, branch, location, RBAC, and core-enterprise routes now declare explicit Fastify `Body`/`Params` route generics.
- Route handlers consume typed `request.body` and `request.params` instead of broad `any`/unsafe casts.
- Zod-inferred body types are used where schemas already exist, avoiding duplicate unchecked body shapes.
- No additional type-provider package was introduced solely to obtain inference; explicit Fastify generics keep the dependency surface smaller while preserving compile-time route contracts.

**Validation remaining**: Typecheck and route regression suite in VS Code/Copilot.

### IMP-024 — Test Infrastructure Improvements
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Implementation**:
- Unit and integration Vitest configurations remain separated.
- Added shared deterministic identity/header/pagination factories.
- Added standardized integration database URL/pool/client helpers.
- Added rollback-transaction helper and standardized pool cleanup.
- Test application creation now reuses the centralized integration pool helper and supplies the required test-only MFA key.
- Added focused tests for migration recovery governance, query-performance monitoring, and API version headers.

**Decision**: Testcontainers is intentionally optional rather than mandatory because the existing PostgreSQL 17 CI service already exercises the real database and RLS with a `NOSUPERUSER NOBYPASSRLS` role.

### IMP-025 — CI/CD Pipeline
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Implementation**:
- Backend CI performs `npm ci`, lint quality gate, generated-config drift check, migration-recovery verification, typecheck, unit tests, build, production Docker build, and PostgreSQL 17 integration tests.
- Integration role is non-superuser with `NOBYPASSRLS`.
- Added tag/manual backend release workflow.
- Release workflow repeats quality/build/database validation before image publication.
- Images publish to GitHub Container Registry with immutable release and commit-SHA tags, provenance, and SBOM generation.

**Validation remaining**: Execute the updated workflows and confirm repository/package permissions in GitHub.

### IMP-026 — Production Dockerfile
**Status**: COMPLETED  
**Implementation**: Multi-stage production build, non-root runtime, minimal runtime contents, health check, and `.dockerignore` are present. Local Docker remains an environment limitation; CI provides the intended build environment.

---

## Database & Migration Improvements

### IMP-027 — Migration Rollback / Recovery Strategy
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Implementation**:
- Recovery procedure and per-migration manifest remain authoritative.
- Added reusable typed recovery-governance verifier.
- Verification rejects journal/manifest drift, unsupported strategies, invalid destructive rollback decisions, and unsafe forward-only security rollback.
- `automated-down` is only permitted when an explicit reviewed automated recovery test is named and destructive rollback is explicitly allowed.
- Added unit coverage for governance invariants.
- Existing migrations are not given fabricated unsafe `down` SQL.
- CI and release workflows execute `db:verify-recovery`.

**Validation remaining**: Run unit/CI validation and collect staging recovery evidence where the manifest calls for restore or compensating migration.

### IMP-028 — Query Performance Monitoring
**Status**: IMPLEMENTED — DATABASE VALIDATION PENDING  
**ADR**: ADR-0022  
**Implementation**:
- Uses `pg_stat_statements` aggregate metrics.
- Explicitly avoids selecting/exposing raw SQL text or query parameters.
- Supports threshold/limit controls with safe bounds.
- Fails closed when the extension is absent, permissions are insufficient, or a database error occurs.
- Application startup records aggregate availability, slow-statement count, and maximum mean execution time without logging query text.
- Unit coverage verifies privacy and unavailable/error behavior.

**Validation remaining**: Validate against a PostgreSQL deployment with `pg_stat_statements` enabled and sufficient read permission.

### IMP-029 — Table Partitioning Strategy
**Status**: FUTURE — EVIDENCE REQUIRED  
**ADR**: ADR-0023  
**Decision**: No blanket table partitioning will be implemented. Existing assessment/tooling remains the approved implementation until real row counts, retention patterns, query plans, or maintenance evidence justify partitioning a specific table. This is intentional architectural governance, not unfinished work.

---

## Cross-Cutting Concerns

### IMP-030 — API Versioning Strategy
**Status**: IMPLEMENTED — VALIDATION PENDING  
**ADR**: ADR-0024  
**Implementation**:
- Versioned path remains explicit through `API_PREFIX` with `/api/v1` default.
- Application derives and advertises the active version using `x-api-version`.
- Versioned API responses advertise `x-api-version-policy: path`.
- Version headers are exposed through CORS.
- Added integration coverage for the `/api/v1` version-header contract.
- Existing compatibility/deprecation policy remains the governing evolution mechanism.

**Validation remaining**: Run integration/runtime validation and confirm proxy/load-balancer preservation of version headers.

### IMP-031 — Repository Interfaces in Domain Layer
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Implementation decision**:
- `src/domain/contracts/repositories.ts` is the single source of truth for repository interfaces and records.
- Application and infrastructure services use domain-owned contracts where migrated.
- `src/application/contracts/security.ts` contains no duplicate repository interface declarations; its remaining repository exports are explicitly deprecated **type-only compatibility re-exports**.
- New code is directed to import repository contracts directly from the domain layer.
- The compatibility bridge is intentionally retained for the remaining legacy monolithic PostgreSQL repository consumer until that repository is split/refactored; removing the bridge before its final consumer moves would create churn without changing ownership or runtime dependency direction.

**Validation remaining**: Typecheck and dependency/import audit. Removal of the deprecated bridge is cleanup after the legacy repository split, not an incomplete domain-ownership implementation.

### IMP-032 — Configuration Documentation
**Status**: COMPLETED  
**Implementation**: Generated configuration reference, schema defaults/constraints, `.env.example`, MFA/JWT/database/security settings, and CI drift verification are synchronized.

---

## Remaining Work After This Implementation Pass

There are **no remaining PENDING or PARTIAL implementation items** in IMP-001 through IMP-032. The remaining work is deliberately limited to:

1. VS Code/Copilot validation of the implementation changes: install/quality, typecheck, unit tests, PostgreSQL integration tests, build, HTTP runtime, OpenAPI, RLS/tenant-isolation regression, and diff checks.
2. Deployment/provider evidence for external notification delivery, file storage, workers, production JWT/MFA keys, and `pg_stat_statements`.
3. GitHub Actions execution for updated CI/release workflows and registry permissions.
4. IMP-029 partitioning only when objective workload evidence satisfies ADR-0023.
5. Product-policy decision on mandatory MFA during login; the MFA capability itself is implemented.

Do not convert these validation/provider/evidence items into fabricated implementation work or weaken security/database controls merely to make a status appear green.

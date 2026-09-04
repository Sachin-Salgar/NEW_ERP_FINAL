# Improvement Implementation Status — 2026-09-04

This status record supplements `IMPROVEMENTS.md` and records implementation details that are useful for validation. Runtime validation remains the responsibility of the VS Code/Copilot environment where a real PostgreSQL deployment is available.

## Current implementation state

The improvement pass has moved the branch from several ADR-gated foundations into implementation. Architectural approval does not equal runtime verification. Items explicitly marked **VALIDATION PENDING** still require execution and evidence.

### IMP-004 — Audit Logging Foundation

Implemented the audit foundation with:

- domain/application audit contracts and PostgreSQL persistence
- active-transaction reuse
- tenant-scoped RLS enforcement
- transactional audit requirement
- allowlisted metadata handling
- append-only/RLS database protection

**ADR**: ADR-0014 — Approved 2026-09-04.

**Validation**: Pending runtime integration and end-to-end application-service evidence.

### IMP-005 — Email Verification / Password Recovery

Implemented the persistence/service foundation:

- cryptographically random single-use tokens
- hashed token persistence and expiry
- dedicated token lifecycle rather than relying only on legacy nullable user columns
- password-reset session invalidation inside a tenant-scoped transaction
- identity-based pre-auth recovery lookup so client-supplied tenant identity is not trusted as authorization

**ADR**: ADR-0015 — Approved 2026-09-04.

**Remaining**: HTTP route wiring and provider-neutral notification/email delivery integration, followed by runtime validation.

### IMP-006 — MFA (TOTP)

Implemented the security foundation:

- RFC 6238 TOTP generation/verification with test vectors
- AES-256-GCM protection for TOTP secrets
- enrollment confirmation before activation
- hashed one-time recovery codes
- PostgreSQL persistence/migration

**ADR**: ADR-0016 — Approved 2026-09-04.

**Remaining**: HTTP route wiring, production MFA encryption-key configuration/injection, and runtime validation.

### IMP-009 — Unit of Work / Transactions

Implemented the application/service transaction boundary for user registration and tenant bootstrap.

- Added `TransactionRunner` application contract.
- Added `UnitOfWork` with explicit begin/commit/rollback and `runInTransaction()`.
- Added transaction-scoped `AsyncLocalStorage` context.
- Updated tenant context so repository calls reuse the service-owned transaction client instead of opening nested transactions.
- Prevented a transaction from switching between tenant IDs.
- Wired `UserRegistrationService` into the transaction boundary from the HTTP application.
- Added transaction coverage for lifecycle, commit failure, service boundaries, shared-client reuse, and cross-tenant rejection.

**Validation**: Pending runtime/typecheck/integration execution in VS Code/Copilot.

### IMP-013 — Pagination

Implemented the authoritative API pagination contract using `page`, `page_size`, `sort`, `order`, and `search`.

- Added shared pagination parsing and response metadata.
- Added endpoint-specific sorting/filtering support.
- Added pagination to RBAC role and permission list handlers.
- Added cross-cutting list-response pagination for organizations, branches, locations, users, and authentication modules.
- Maximum `page_size` is `100`.
- Existing clients without pagination query parameters retain existing list-response behavior.
- Did not introduce `limit` or `cursor` as public parameters.

**Implementation note**: current pagination bounds the API response after the tenant-scoped repository query. SQL-level bounded retrieval is a later performance optimization and must preserve the same public contract and RLS guarantees.

**Validation**: Pending runtime/API contract validation in VS Code/Copilot.

### IMP-014 — Notification Service

Implemented provider-neutral platform foundation:

- notification contracts
- PostgreSQL queue/history persistence with tenant RLS
- leasing/claiming
- delivery worker foundation
- retry/backoff behavior

**ADR**: ADR-0017 — Approved 2026-09-04.

**Remaining**: concrete provider integration and runtime operational validation.

### IMP-015 — File Storage Service

Implemented provider-neutral storage foundation:

- storage contracts
- tenant-scoped file metadata persistence
- authorization-aware storage orchestration
- injected provider boundary

**ADR**: ADR-0018 — Approved 2026-09-04.

**Remaining**: deployment-specific provider implementation/configuration and runtime validation.

### IMP-016 — Scheduler Service

Implemented durable scheduler foundation:

- persistent jobs
- leasing/retry model
- injected handler boundary

**ADR**: ADR-0019 — Approved 2026-09-04.

**Remaining**: runtime worker validation and deployment operations.

### IMP-017 — Event-Driven Architecture

Implemented the approved modular-monolith event foundation:

- versioned event contracts
- PostgreSQL transactional outbox with tenant RLS
- dispatcher/worker foundation
- explicit outbox lease/claim state to prevent duplicate concurrent delivery after transaction completion
- no external message broker introduced prematurely

**ADRs**: ADR-0008 and ADR-0020 — Approved 2026-09-04.

**Remaining**: runtime validation and broader module adoption.

### IMP-020 — JWT Key Rotation / JWKS

The concrete asymmetric algorithm has now been selected: **RS256**.

Implemented:

- key-ring lifecycle with active, verification-only and retired states
- `kid` support
- RS256 signing/verification mode
- JWKS publication at `/.well-known/jwks.json`
- opt-in legacy HS256 verification through `JWT_ACCEPT_LEGACY_HS256`
- configuration/schema/documentation support for the new key strategy
- key lifecycle/JWKS invariant coverage

**ADR**: ADR-0021 — Approved 2026-09-04.

**Remaining**: runtime validation and production key provisioning/rotation procedure validation.

### IMP-024 — Test Infrastructure

Extended the split unit/integration test setup with reusable fixtures and helpers for tenant/application/database/transaction/pagination scenarios.

Testcontainers remains optional future infrastructure rather than an unreviewed dependency requirement.

**Remaining**: further standardization and validation as the integration suite expands.

### IMP-027 — Migration Rollback / Recovery

Implemented the governance and machine-enforcement foundation:

- migration recovery procedure and classifications
- required recovery manifest
- verification script
- `db:verify-recovery` package command
- no unsafe synthetic `down` SQL added to existing migrations

**Remaining**: per-migration automated recovery tests where genuinely non-destructive, plus CI/staging evidence.

### IMP-028 — Query Performance Monitoring

Implemented the service foundation using PostgreSQL `pg_stat_statements` aggregates and a slow-query threshold concept without exposing raw query text/parameters through the application API.

**ADR**: ADR-0022 — Approved 2026-09-04.

**Remaining**: runtime database-extension validation and final operational monitoring/exposure integration.

### IMP-029 — Table Partitioning

Implemented assessment tooling and adopted the approved evidence-driven policy. No blanket table partitioning has been introduced.

**ADR**: ADR-0023 — Approved 2026-09-04.

**Status**: Future/evidence required. Actual partitioning requires workload, row-growth and PostgreSQL RLS evidence.

### IMP-030 — API Versioning Strategy

Implemented the API-versioning policy/documentation around explicit `/api/v1` versioning and compatibility/deprecation guidance.

**ADR**: ADR-0024 — Approved 2026-09-04.

**Remaining**: final migration/compatibility validation before treating the versioning policy as production-stable.

### IMP-031 — Domain Repository Interfaces

Migrated repository contract imports for branch, location, enterprise, authorization, and platform bootstrap application services to `src/domain/contracts/repositories.ts`.

Compatibility re-exports remain in `src/application/contracts/security.ts` for unmigrated consumers.

**Remaining**: complete remaining imports and remove compatibility exports when safe.

## Previously verified improvements

The branch already contains completed/previously validated implementation for IMP-001, IMP-002, IMP-003, IMP-007, IMP-008, IMP-011, IMP-012, IMP-018, IMP-019, IMP-021, IMP-026, and IMP-032. Earlier runtime validation for IMP-003 also covered real application startup, OpenAPI exposure, invalid-request handling, and regression/typecheck/build checks.

## Architecture review and approval

The following ADRs were approved on 2026-09-04 under the Project Owner's authorization:

| Improvement | ADR | Status |
|---|---|---|
| IMP-004 Audit Logging Foundation | ADR-0014 | **Approved** |
| IMP-005 Email Verification / Password Recovery | ADR-0015 | **Approved** |
| IMP-006 MFA (TOTP) | ADR-0016 | **Approved** |
| IMP-014 Notification Service | ADR-0017 | **Approved** |
| IMP-015 File Storage Service | ADR-0018 | **Approved** |
| IMP-016 Scheduler Service | ADR-0019 | **Approved** |
| IMP-017 Event-Driven Architecture | ADR-0020 | **Approved** |
| IMP-020 JWT Key Rotation / JWKS | ADR-0021 | **Approved** |
| IMP-028 Query Performance Monitoring | ADR-0022 | **Approved** |
| IMP-029 Table Partitioning | ADR-0023 | **Approved** |
| IMP-030 API Versioning Strategy | ADR-0024 | **Approved** |

ADR-0008 (Event Contracts & Versioning) and ADR-0009 (Refresh Token Rotation) were also reviewed and approved as supporting architectural decisions.

## Dependency-gated work

IMP-022 ESLint + Prettier remains pending because the repository does not yet have the required reproducible ESLint/Prettier dependency set and lockfile entries. Adding configuration without deterministic dependencies would leave CI non-reproducible.

IMP-025 CI/CD remains partial because linting depends on IMP-022 and release/image publishing policy has not yet been finalized.

## Verification state

No new runtime verification is claimed for the implementation work above unless explicitly stated as previously verified. The authoritative backlog is `IMPROVEMENTS.md`; this document records implementation detail and validation gates, not a substitute for runtime evidence.

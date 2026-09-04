# Improvement Implementation Status — 2026-09-04

This status record supplements `IMPROVEMENTS.md` without changing its original backlog wording. Runtime validation remains the responsibility of the VS Code/Copilot environment where a real PostgreSQL deployment is available.

## Implemented in this pass

### IMP-009 — Unit of Work / Transactions

Implemented the application/service transaction boundary for user registration and tenant bootstrap.

- Added `TransactionRunner` application contract.
- Added `UnitOfWork` with explicit begin/commit/rollback and `runInTransaction()`.
- Added transaction-scoped `AsyncLocalStorage` context.
- Updated tenant context so repository calls reuse the service-owned transaction client instead of opening nested transactions.
- Prevented a transaction from switching between tenant IDs.
- Wired `UserRegistrationService` into the transaction boundary from the HTTP application.
- Wired the development tenant bootstrap script into the transaction boundary.
- Added unit coverage for transaction lifecycle, commit failure, service boundaries, shared client reuse, and cross-tenant transaction rejection.

**Validation**: Pending runtime/typecheck/integration execution in VS Code/Copilot.

### IMP-013 — Pagination

Implemented the authoritative API pagination contract using `page`, `page_size`, `sort`, `order`, and `search`.

- Added shared pagination parsing and response metadata.
- Added filtering and endpoint-specific sorting.
- Added pagination to RBAC role and permission list handlers.
- Added cross-cutting list-response pagination for organizations, branches, locations, users, and authentication modules.
- Maximum `page_size` is `100`.
- Existing clients without pagination query parameters retain their existing list response behavior.
- Explicitly did not introduce `limit` or `cursor` as public parameters.

**Implementation note**: current pagination bounds the API response after the tenant-scoped repository query. SQL-level bounded retrieval is a later performance optimization and must preserve the same public contract and RLS guarantees.

**Validation**: Pending runtime/API contract validation in VS Code/Copilot.

### IMP-024 — Test Infrastructure

Extended the existing split unit/integration test setup with reusable fixtures:

- tenant bootstrap factory
- database pool factory
- application factory
- transaction-boundary tests
- pagination tests

Testcontainers remains optional future infrastructure rather than being introduced without the required dependency and CI decision.

### IMP-031 — Domain Repository Interfaces

Migrated the repository contract imports for branch, location, enterprise, authorization, and platform bootstrap application services to `src/domain/contracts/repositories.ts`. The compatibility exports in `src/application/contracts/security.ts` remain for unmigrated consumers.

## Architecture review and approval

Architecture review was completed against the repository ADR governance, authentication/authorization model, PostgreSQL RLS multi-tenancy model, modular-monolith architecture, zero-downtime migration strategy, lifecycle governance, OpenAPI contract, correlation-ID implementation, and the existing proposed event/refresh-token decisions.

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

ADR-0008 (Event Contracts & Versioning) and ADR-0009 (Refresh Token Rotation) were also reviewed because the new approved decisions depend on their contracts. Both were approved as supporting architectural decisions.

### Review conditions that remain implementation gates

Approval of an ADR authorizes implementation of its architectural direction; it does not mean the implementation is already complete or runtime-verified.

- **ADR-0021 / IMP-020:** the concrete JWT asymmetric algorithm must be selected and documented in the security baseline before implementation. The ADR approves asymmetric signing, `kid` lifecycle, JWKS publication, overlap, and fail-closed verification; it does not silently select an algorithm absent from the current security baseline.
- **ADR-0023 / IMP-029:** no table is to be partitioned merely because the ADR exists. A candidate requires workload/row-growth evidence and a separate migration assessment with real PostgreSQL RLS validation.
- **ADR-0024 / IMP-030:** do not mechanically prefix current routes. Establish the supported-version matrix, migration plan, deprecation period, and compatibility suite before declaring `/api/v1` production-stable.
- **ADR-0017 / IMP-014 and ADR-0019 / IMP-016:** initial implementations should remain database-backed and provider-neutral; a broker or external scheduler is not required prematurely.
- **ADR-0020 / IMP-017:** use the transactional outbox and approved event-contract compatibility rules; do not introduce a message broker merely to satisfy the ADR.

These are implementation constraints, not unresolved architectural decisions.

## Dependency-gated work

IMP-022 ESLint + Prettier is not marked complete because the repository currently has no ESLint/Prettier dependency set or lockfile entries. Adding configuration without reproducible dependencies would leave CI non-deterministic. This requires a dependency installation/update followed by validation.

## Verification state

No GitHub Actions workflow run was available for the new commits at the time this record was written. Therefore implementation has not been represented as runtime-verified. ADR approval is architectural approval only and does not replace implementation validation.
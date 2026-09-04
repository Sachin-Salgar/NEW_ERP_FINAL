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

## Still governed / intentionally not implemented

The following remain blocked until their required ADR/architecture decisions are approved:

- IMP-004 Audit Logging Foundation
- IMP-005 Email Verification / Password Recovery
- IMP-006 MFA (TOTP)
- IMP-014 Notification Service
- IMP-015 File Storage Service
- IMP-016 Scheduler Service
- IMP-017 Event-Driven Architecture
- IMP-020 JWT Key Rotation / JWKS
- IMP-028 Query Performance Monitoring
- IMP-029 Table Partitioning
- IMP-030 API Versioning Strategy

No implementation bypasses these governance gates.

## Dependency-gated work

IMP-022 ESLint + Prettier is not marked complete because the repository currently has no ESLint/Prettier dependency set or lockfile entries. Adding configuration without reproducible dependencies would leave CI non-deterministic. This requires a dependency installation/update followed by validation.

## Verification state

No GitHub Actions workflow run was available for the new commits at the time this record was written. Therefore implementation has not been represented as runtime-verified.

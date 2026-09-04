# NEW_ERP_FINAL — Improvement Backlog

**Generated**: 2026-09-04  
**Source**: Architectural analysis against `docs/` authoritative documentation  
**Status**: Living document — synchronized with implementation state on `feat/improvements`

---

## Executive Summary

This document catalogs all identified improvements for the NEW_ERP_FINAL ERP backend, categorized by priority and mapped to architectural principles from `docs/00-overview/01-architectural-principles.md` and governance rules from `docs/00-overview/02-governance.md`.

**Current State**: Modular monolith with Fastify, TypeScript, PostgreSQL (Drizzle), JWT auth, and RLS multi-tenancy. The branch now contains substantial security, transaction, platform-service, migration-governance, API, and operational foundations. The remaining gaps are primarily runtime validation, incomplete HTTP/provider wiring, developer-experience tooling, CI/release completion, and evidence-driven future work.

**Validation model**: Implementation work may be completed directly on `feat/improvements`; runtime validation is explicitly tracked as **VALIDATION PENDING** when it must be executed from the user's VS Code/Copilot environment. An item is not considered fully verified until the prescribed validation evidence is available.

**Important status rule**:
- **COMPLETED** = implementation and available verification evidence are sufficient for the backlog item.
- **IMPLEMENTED — VALIDATION PENDING** = implementation is present, but runtime/full validation evidence is still required.
- **PARTIAL** = meaningful implementation exists, but a defined portion of the original scope remains.
- **PENDING** = implementation has not yet been completed.
- **FUTURE / EVIDENCE REQUIRED** = intentionally deferred by an approved architectural decision until objective evidence justifies it.

---

## Priority Classification

| Priority | Meaning | SLA Target |
|----------|---------|------------|
| **P0** | Blocking compliance, security, or core functionality | Immediate |
| **P1** | Required by architectural principles (Platform First, Audit Everything) | Next sprint |
| **P2** | Developer experience, consistency, operational maturity | Within 2 sprints |
| **P3** | Platform services per Principle 5 (Platform Before Features) | Requires ADR |
| **P4** | Security hardening, future-proofing | Ongoing |

---

## P0 — Critical (Immediate)

### 1. OpenAPI/Swagger Documentation
**Status**: COMPLETED  
**Principle**: API-First Development (Principle 4)  
**Gap**: No machine-readable API contract; frontend consumers rely on manual inspection  
**Implementation**:
- Added `@fastify/swagger` + `@fastify/swagger-ui`
- Generates the OpenAPI contract from the runtime schemas
- Exposes `/docs` and `/docs/json`
- Includes authentication, error responses, pagination, organization/branch/location/RBAC/core-enterprise routes
**Verification**: Runtime documentation endpoint was previously validated with OpenAPI 3.0.3 and 43 runtime paths.
**Files**: `src/presentation/http/swagger.ts`, `src/presentation/http/app.ts`

### 2. Rate Limiting on Auth Endpoints
**Status**: COMPLETED  
**Principle**: Security by Design (Principle 7)  
**Implementation**:
- Added `@fastify/rate-limit`
- Login/register: 5 requests/minute
- Refresh: 10 requests/minute
- Retry-After handling
**File**: `src/presentation/http/app.ts`

### 3. Request Validation Pipeline
**Status**: COMPLETED  
**Principle**: Consistency Over Convenience (Principle 9)  
**Implementation**:
- Centralized Fastify runtime validation using Zod-derived JSON schemas
- Bodies, path parameters, query parameters and headers covered for applicable routes
- Invalid requests return standardized 400 responses before handlers
- Unsafe request-body/params/query/header casts were removed from route files
**Verification**: Runtime validation was previously exercised against real DB/application startup; 9/9 invalid probes returned 400 and the full prior suite/typecheck/build/diff checks were green.

### 4. Audit Logging Foundation
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Principle**: Audit Everything Important (Principle 8)  
**Implementation**:
- Added audit contract/domain model and PostgreSQL implementation
- Audit persistence reuses the active transaction and tenant RLS context
- Transactional audit calls require an active transaction
- Added migration and append-only/RLS protection
- Allowlisted audit metadata includes correlation information
**ADR**: ADR-0014 Audit Logging Foundation — Approved 2026-09-04
**Validation**: Runtime integration and end-to-end application-service audit coverage remain pending.

---

## P1 — High (Next Sprint)

### 5. Email Verification Flow
**Status**: PARTIAL — FOUNDATION IMPLEMENTED, HTTP WIRING PENDING  
**Principle**: Backend Owns Business Logic (Principle 1)  
**Implementation**:
- Dedicated cryptographically random, hashed, single-use token persistence
- Email-verification/password-recovery service foundation
- Password-reset consumption invalidates active sessions inside a tenant-scoped transaction
- Pre-auth recovery uses identity-based global lookup rather than trusting client-supplied tenant authority
- Notification/email integration is intentionally not implemented as unsafe raw-token persistence
**ADR**: ADR-0015 Email Verification and Password Recovery — Approved 2026-09-04
**Remaining**: Complete and validate the HTTP routes and provider-neutral notification/email delivery wiring.

### 6. MFA (TOTP) Implementation
**Status**: PARTIAL — FOUNDATION IMPLEMENTED, HTTP WIRING PENDING  
**Principle**: Security by Design (Principle 7)  
**Implementation**:
- RFC 6238 TOTP implementation and test vectors
- AES-256-GCM protection for TOTP secrets
- Enrollment confirmation before activation
- Hashed one-time recovery codes
- PostgreSQL persistence/migration
**ADR**: ADR-0016 Multi-Factor Authentication with TOTP — Approved 2026-09-04
**Remaining**: Complete HTTP routes and production configuration/injection for the MFA encryption key; perform runtime validation.

### 7. Soft Delete Consistency Audit
**Status**: COMPLETED  
**Principle**: Database Is the Single Source of Truth (Principle 3)  
**Implementation**: Repository soft-delete filtering and regression coverage completed.

### 8. Enhanced Health Check Endpoint
**Status**: COMPLETED  
**Principle**: Observability (DevOps)  
**Implementation**: Database connectivity/latency, pool snapshot, readiness/liveness, uptime and health details are implemented and covered by tests.

---

## P2 — Medium (Within 2 Sprints)

### 9. Transaction Support (Unit of Work)
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Principle**: Backend Owns Business Logic (Principle 1)  
**Implementation**:
- Added `UnitOfWork` with `begin`, `commit`, `rollback`, and `runInTransaction`
- Added AsyncLocalStorage transaction context
- Reuses active transaction clients in tenant context
- Rejects cross-tenant transaction-context switching
- Integrated transaction runners into `UserRegistrationService` and `TenantBootstrapService` where applicable
- Added unit coverage for transaction lifecycle/context/service boundaries
**Remaining**: Run the full integration/runtime validation in VS Code/Copilot and complete any remaining caller migration without weakening RLS or introducing nested competing transactions.

### 10. RFC 7807 Problem Details Error Format
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Principle**: Consistency Over Convenience (Principle 9)  
**Implementation**:
- Supports `application/problem+json` with `type`, `title`, `status`, `detail`, `instance`, and `errors`
- Explicit `Accept: application/problem+json` opts into the representation
- Existing error envelope is preserved for absent/wildcard Accept headers
- 5xx responses avoid exposing internal details
**Validation**: Unit coverage exists; runtime validation remains pending.
**Files**: `src/infrastructure/http/error-handler.ts`, `tests/unit/error-handler.test.ts`

### 11. Correlation ID Propagation
**Status**: COMPLETED  
**Principle**: Audit Everything Important (Principle 8)  
**Implementation**: Correlation ID generation/extraction and AsyncLocalStorage propagation are implemented and integrated with the application logging/audit path.

### 12. Fix `organization_modules` Schema Gap
**Status**: COMPLETED  
**Principle**: Database First Philosophy (Principle 5)  
**Implementation**: `organization_modules` schema/migration is present and migration registration/recovery handling is in place.

### 13. Pagination on List Endpoints
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Principle**: Consistency Over Convenience (Principle 9)  
**Implementation**:
- Authoritative contract uses `page`, `page_size`, `sort`, `order`, and `search`
- Added shared pagination parser/meta/response helpers
- RBAC roles/permissions use the pagination helpers explicitly
- Application response pagination covers organization, branch, location, user, and auth-module list endpoints while preserving legacy responses when pagination parameters are absent
**Important limitation**: Pagination is currently response-level after repository retrieval; SQL LIMIT/OFFSET or keyset pagination is not yet implemented. Swagger wording should remain aligned with the authoritative API standard.
**Validation**: Runtime/list-contract validation remains pending.

---

## P3 — Platform Services

> ADRs for all originally ADR-gated P3 platform items have now been approved. Implementation may proceed under those decisions; remaining work must still respect tenant isolation, RLS, authorization, provider abstraction, and modular-monolith boundaries.

### 14. Notification Service
**Status**: IMPLEMENTED — FOUNDATION / VALIDATION PENDING  
**Principle**: Platform Before Features (Principle 5)  
**ADR**: ADR-0017 Notification Service — Approved 2026-09-04  
**Implementation**:
- Provider-neutral notification contracts
- PostgreSQL notification queue/history persistence with tenant RLS
- Leasing, delivery-worker, retry and backoff foundation
**Remaining**: Concrete provider integration and runtime operational validation.

### 15. File Storage Service
**Status**: IMPLEMENTED — FOUNDATION / PROVIDER PENDING  
**Principle**: Platform Before Features (Principle 5)  
**ADR**: ADR-0018 File Storage Service — Approved 2026-09-04  
**Implementation**:
- Provider-neutral storage contracts
- Tenant-scoped metadata persistence
- Storage orchestration with injected provider and authorization controls
**Remaining**: Deployment-specific provider implementation/configuration and runtime validation.

### 16. Scheduler Service
**Status**: IMPLEMENTED — FOUNDATION / VALIDATION PENDING  
**Principle**: Platform Before Features (Principle 5)  
**ADR**: ADR-0019 Scheduler Service — Approved 2026-09-04  
**Implementation**:
- Durable job persistence
- Leasing/retry foundation
- Injected job-handler model
**Remaining**: Runtime worker validation and deployment operations.

### 17. Event-Driven Architecture (Domain Events)
**Status**: IMPLEMENTED — FOUNDATION / VALIDATION PENDING  
**Principle**: Modular Monolith (Principle 4)  
**ADR**: ADR-0008 Event Contracts & Versioning and ADR-0020 Event-Driven Architecture — Approved 2026-09-04  
**Implementation**:
- Versioned event-contract foundation
- PostgreSQL outbox persistence with tenant RLS
- Dispatcher/worker foundation
- Explicit outbox lease/claim state prevents duplicate concurrent delivery after transaction completion
- No external broker was introduced, consistent with the approved modular-monolith architecture
**Remaining**: Runtime validation and further module adoption.

---

## P4 — Security Hardening & Future-Proofing

### 18. Account Lockout After Failed Attempts
**Status**: COMPLETED  
**Implementation**: Failed-login counting, lockout duration, reset-on-success, `423 Locked`, `Retry-After`, contracts and regression coverage are implemented.

### 19. Password Policy Enforcement
**Status**: COMPLETED  
**Implementation**: Configurable password policy is enforced in registration/password-change paths; configuration boolean parsing was hardened so explicit `false` values remain false.

### 20. JWT Key Rotation (JWKS)
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Principle**: Security by Design (Principle 7)  
**ADR**: ADR-0021 JWT Signing-Key Rotation and JWKS — Approved 2026-09-04  
**Selected algorithm**: **RS256**  
**Implementation**:
- Key-ring lifecycle with active, verification-only and retired states
- `kid` support
- JWKS endpoint at `/.well-known/jwks.json`
- RS256 signing/verification support
- Legacy HS256 verification is opt-in through `JWT_ACCEPT_LEGACY_HS256`
- Configuration/schema/documentation updated for the new key strategy
**Remaining**: Runtime validation and production key provisioning/rotation procedure validation.

### 21. Request Size Limits
**Status**: COMPLETED  
**Implementation**: Global Fastify body limit plus tighter auth-route limits and `413` handling are implemented.

---

## Code Quality & Developer Experience

### 22. ESLint + Prettier
**Status**: PENDING  
**Principle**: Consistency Over Convenience (Principle 9)  
**Remaining**: Establish project ESLint/Prettier configuration and scripts, then wire linting into CI.

### 23. Type-Safe Route Definitions
**Status**: PARTIAL  
**Principle**: Consistency Over Convenience (Principle 9)  
**Implementation**: Runtime schemas and unsafe casts were substantially removed by IMP-003.  
**Remaining**: End-to-end Fastify type-provider inference is not yet implemented.

### 24. Test Infrastructure Improvements
**Status**: PARTIAL  
**Principle**: Documentation Is Part of the Product (Principle 10)  
**Implementation**:
- Separate unit/integration Vitest configurations
- `npm test` executes both explicitly
- Plain `vitest` defaults to database-independent unit tests
- Shared fixtures/helpers improved
**Remaining**: Fully standardize reusable factories and optional testcontainers/global integration setup.

### 25. CI/CD Pipeline
**Status**: PARTIAL  
**Principle**: DevOps  
**Implementation**:
- `.github/workflows/backend-ci.yml` runs generated-config drift verification, typecheck, unit tests, backend build, Docker build and PostgreSQL 17 integration tests using a non-superuser `NOBYPASSRLS` role
**Remaining**: Lint job after IMP-022, release/image publishing policy, and any final CI hardening.

### 26. Production Dockerfile
**Status**: COMPLETED  
**Implementation**: Multi-stage production image, non-root runtime, dist-only runtime contents, health check and `.dockerignore` are present. Backend CI previously built the image successfully.

---

## Database & Migration Improvements

### 27. Migration Rollback Strategy
**Status**: PARTIAL — GOVERNANCE IMPLEMENTED  
**Principle**: Database First Philosophy (Principle 5)  
**Implementation**:
- Recovery classification/procedure documented in `docs/03-database/20-migration-recovery-procedure.md`
- Machine-enforced recovery manifest added
- Verification script and package command `db:verify-recovery` added
- Existing migrations were not given unsafe synthetic `down` SQL
**Remaining**: Per-migration automated recovery tests where genuinely non-destructive, plus CI/staging evidence.

### 28. Query Performance Monitoring
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Principle**: Observability (DevOps)  
**ADR**: ADR-0022 Query Performance Monitoring — Approved 2026-09-04  
**Implementation**:
- Query-performance service foundation using `pg_stat_statements` aggregates
- Slow-query threshold concept
- Does not expose raw query text/parameters as an application API
**Remaining**: Runtime/database-extension validation and final operational exposure/monitoring integration.

### 29. Table Partitioning Strategy (Future)
**Status**: FUTURE — EVIDENCE REQUIRED  
**Principle**: Database First Philosophy (Principle 5)  
**ADR**: ADR-0023 Table Partitioning Strategy — Approved 2026-09-04  
**Decision**: Evidence-driven partitioning; no blanket partitioning is implemented now. 
**Assessment**: Partitioning assessment/tooling is present, but actual partitioning remains intentionally deferred until workload/data evidence justifies it.

---

## Cross-Cutting Concerns

### 30. API Versioning Strategy
**Status**: IMPLEMENTED — VALIDATION PENDING  
**Principle**: API-First Development (Principle 4)  
**ADR**: ADR-0024 API Versioning Strategy — Approved 2026-09-04  
**Decision**: Explicit `/api/v1` versioning policy with compatibility/deprecation guidance rather than an undocumented header-only versioning convention.
**Implementation**: Versioning policy and implementation documentation added; migration/compatibility validation remains pending.

### 31. Repository Interfaces in Domain Layer
**Status**: PARTIAL  
**Principle**: Separation of Concerns (Principle 7)  
**Implementation**:
- Repository interfaces/records now have their source of truth in `src/domain/contracts/repositories.ts`
- Compatibility re-exports remain in `src/application/contracts/security.ts`
- Branch/location/enterprise/authorization/platform bootstrap service imports have been migrated where identified
**Remaining**: Complete remaining imports and remove compatibility exports when no longer required.

### 32. Configuration Documentation
**Status**: COMPLETED  
**Principle**: Documentation Is Part of the Product (Principle 10)  
**Implementation**: Generated configuration reference, `.env.example` synchronization, boolean parsing hardening, and CI drift verification are implemented.

---

## Tracking

| ID | Title | Priority | Status | Owner | Target | ADR Required |
|----|-------|----------|--------|-------|--------|--------------|
| IMP-001 | OpenAPI/Swagger Documentation | P0 | **Completed** | — | Sprint 1 | No |
| IMP-002 | Rate Limiting on Auth | P0 | **Completed** | — | Sprint 1 | No |
| IMP-003 | Request Validation (Zod) | P0 | **Completed** | — | Sprint 1 | No |
| IMP-004 | Audit Logging Foundation | P0 | **Implemented — Validation Pending** | — | Sprint 2 | **Approved ADR-0014** |
| IMP-005 | Email Verification Flow | P1 | **Partial — HTTP Wiring Pending** | — | Sprint 2 | **Approved ADR-0015** |
| IMP-006 | MFA (TOTP) | P1 | **Partial — HTTP Wiring Pending** | — | Sprint 2 | **Approved ADR-0016** |
| IMP-007 | Soft Delete Consistency | P1 | **Completed** | — | Sprint 2 | No |
| IMP-008 | Enhanced Health Check | P1 | **Completed** | — | Sprint 1 | No |
| IMP-009 | Unit of Work / Transactions | P2 | **Implemented — Validation Pending** | — | Sprint 3 | No |
| IMP-010 | RFC 7807 Error Format | P2 | **Implemented — Validation Pending** | — | Sprint 3 | No |
| IMP-011 | Correlation ID Propagation | P2 | **Completed** | — | Sprint 3 | No |
| IMP-012 | Fix organization_modules Schema | P2 | **Completed** | — | Sprint 2 | No |
| IMP-013 | Pagination on List Endpoints | P2 | **Implemented — Validation Pending** | — | Sprint 3 | No |
| IMP-014 | Notification Service | P3 | **Implemented — Foundation / Validation Pending** | — | TBD | **Approved ADR-0017** |
| IMP-015 | File Storage Service | P3 | **Implemented — Foundation / Provider Pending** | — | TBD | **Approved ADR-0018** |
| IMP-016 | Scheduler Service | P3 | **Implemented — Foundation / Validation Pending** | — | TBD | **Approved ADR-0019** |
| IMP-017 | Event-Driven Architecture | P3 | **Implemented — Foundation / Validation Pending** | — | TBD | **Approved ADR-0008 + ADR-0020** |
| IMP-018 | Account Lockout | P4 | **Completed** | — | Sprint 3 | No |
| IMP-019 | Password Policy | P4 | **Completed** | — | Sprint 3 | No |
| IMP-020 | JWT Key Rotation (JWKS) | P4 | **Implemented — Validation Pending** | — | Sprint 4 | **Approved ADR-0021** |
| IMP-021 | Request Size Limits | P4 | **Completed** | — | Sprint 2 | No |
| IMP-022 | ESLint + Prettier | P3 | **Pending** | — | Sprint 2 | No |
| IMP-023 | Type-Safe Routes | P3 | **Partial** | — | Sprint 3 | No |
| IMP-024 | Test Infrastructure | P3 | **Partial** | — | Sprint 2 | No |
| IMP-025 | CI/CD Pipeline | P3 | **Partial** | — | Sprint 2 | No |
| IMP-026 | Production Dockerfile | P3 | **Completed** | — | Sprint 2 | No |
| IMP-027 | Migration Rollback Strategy | P4 | **Partial — Governance Implemented** | — | Ongoing | No |
| IMP-028 | Query Performance Monitoring | P4 | **Implemented — Validation Pending** | — | Sprint 3 | **Approved ADR-0022** |
| IMP-029 | Table Partitioning | P4 | **Future — Evidence Required** | — | Future | **Approved ADR-0023** |
| IMP-030 | API Versioning Strategy | P4 | **Implemented — Validation Pending** | — | TBD | **Approved ADR-0024** |
| IMP-031 | Domain Layer Repository Interfaces | P2 | **Partial** | — | Sprint 3 | No |
| IMP-032 | Configuration Documentation | P4 | **Completed** | — | Sprint 3 | No |

---

## Governance Compliance Checklist

- [x] All ADR-gated items have approved ADRs before implementation proceeded
- [x] No implementation began on ADR-gated items before an approved ADR
- [x] P0/P1 implementation is checked against approved ADRs and authoritative governance before changes
- [ ] Security changes (P0, P1, P4) have not yet received a separately recorded formal Security Architect review
- [x] Database changes (migrations) follow `docs/03-database/` standards
- [x] Documentation updated alongside implementation (Principle 10)

---

## Next Steps

1. Run the prescribed runtime/full validation for IMP-004, IMP-005, IMP-006, IMP-009, IMP-010, IMP-013, IMP-014, IMP-016, IMP-017, IMP-020, IMP-028 and IMP-030 from VS Code/Copilot and record evidence.
2. Complete the remaining HTTP/provider wiring for IMP-005 and IMP-006.
3. Complete IMP-022 ESLint/Prettier and then finish the remaining CI/CD lint/release work in IMP-025.
4. Complete Fastify type-provider inference for IMP-023 and remaining repository-interface migrations for IMP-031.
5. Finish the remaining test-infrastructure standardization for IMP-024.
6. Complete migration recovery automation/CI evidence for IMP-027.
7. Keep IMP-029 intentionally deferred until measurable workload/data evidence supports partitioning.
8. Keep this document synchronized whenever implementation or validation status changes.

---

## References

- `docs/00-overview/01-architectural-principles.md` — 10 binding principles
- `docs/00-overview/02-governance.md` — ADR process, approval authority
- `docs/02-architecture/README.md` — System architecture, layering, patterns
- `docs/10-adr/README.md` — Approved ADRs (check before implementing)
- `docs/03-database/README.md` — Database standards, migration rules
- `docs/04-backend/README.md` — Backend runtime, service design
- `docs/06-security/README.md` — Security architecture, authz/authz
- `docs/07-devops/README.md` — Deployment, CI/CD, observability

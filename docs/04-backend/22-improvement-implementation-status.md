# Improvement Implementation Status — 2026-09-04

This status record supplements `IMPROVEMENTS.md` and records implementation details useful for validation. Runtime validation remains the responsibility of the VS Code/Copilot environment where a real PostgreSQL deployment is available.

## Current implementation state

The improvement implementation pass has completed the defined code-level work that can be safely completed without production-provider credentials, workload evidence, or runtime database execution. Items that depend on those external conditions remain explicitly identified below.

### IMP-004 — Audit Logging Foundation

**Status: IMPLEMENTED — VALIDATION PENDING**

Implemented domain/application contracts, PostgreSQL persistence, active-transaction reuse, tenant/RLS enforcement, transactional audit requirements, allowlisted metadata, migration protection, and append-only/RLS database safeguards.

**ADR**: ADR-0014 — Approved 2026-09-04.

### IMP-005 — Email Verification / Password Recovery

**Status: IMPLEMENTED — VALIDATION PENDING**

Implemented the complete application-to-HTTP path:

- cryptographically random, hashed, single-use email-verification and password-reset tokens
- expiry and atomic token consumption
- password-reset session invalidation
- identity-based pre-auth recovery lookup
- provider-neutral notification queue adapter
- `/auth/email-verification/request`
- `/auth/email-verification/confirm`
- `/auth/password-recovery/request`
- `/auth/password-recovery/reset`
- authenticated email-verification request endpoint
- password-policy enforcement on password reset
- generic password-recovery success response to avoid account enumeration

The notification adapter intentionally targets the platform notification contract; concrete external email delivery remains deployment/provider work.

**ADR**: ADR-0015 — Approved 2026-09-04.

### IMP-006 — MFA (TOTP)

**Status: IMPLEMENTED — VALIDATION PENDING**

Implemented the complete authenticated MFA lifecycle:

- RFC 6238 TOTP generation/verification
- AES-256-GCM persisted-secret protection
- enrollment and enrollment confirmation
- hashed one-time recovery codes
- MFA disablement
- PostgreSQL persistence
- `/auth/mfa/enroll`
- `/auth/mfa/enroll/confirm`
- `/auth/mfa/verify`
- `/auth/mfa/disable`
- Fastify service injection and route registration
- deployment environment documentation for `MFA_ENCRYPTION_KEY`
- production startup fails closed when the MFA encryption key is not explicitly supplied

**ADR**: ADR-0016 — Approved 2026-09-04.

**Remaining external validation**: runtime verification, production secret provisioning, and full login-flow MFA policy enforcement if/when the product requires MFA as a mandatory authentication gate rather than an authenticated step-up facility.

### IMP-009 — Unit of Work / Transactions

**Status: IMPLEMENTED — VALIDATION PENDING**

`TransactionRunner`, `UnitOfWork`, transaction-scoped `AsyncLocalStorage`, tenant-aware client reuse, cross-tenant transaction protection, registration/bootstrap integration, and transaction lifecycle/service-boundary tests are implemented.

### IMP-013 — Pagination

**Status: IMPLEMENTED — VALIDATION PENDING**

The public contract uses `page`, `page_size`, `sort`, `order`, and `search`, with a maximum page size of 100. RBAC handlers and supported list responses are wired. Current pagination remains response-level after tenant-scoped repository retrieval; SQL-level LIMIT/OFFSET/keyset optimization is intentionally a later performance change.

### IMP-014 — Notification Service

**Status: IMPLEMENTED — FOUNDATION / PROVIDER PENDING**

Provider-neutral contracts, PostgreSQL queue/history, tenant RLS, leasing, worker foundation, retry/backoff, and account-security queue integration are implemented. A concrete external email/SMS/push provider is intentionally not hard-coded into the ERP core.

### IMP-015 — File Storage Service

**Status: IMPLEMENTED — FOUNDATION / PROVIDER PENDING**

Provider-neutral storage contracts, tenant-scoped metadata, authorization-aware orchestration, and injected provider boundary are implemented. Concrete object-storage provider deployment remains external configuration/implementation.

### IMP-016 — Scheduler Service

**Status: IMPLEMENTED — FOUNDATION / VALIDATION PENDING**

Durable jobs, leasing/retry model, and injected handler boundary are implemented. Runtime worker/deployment validation remains pending.

### IMP-017 — Event-Driven Architecture

**Status: IMPLEMENTED — FOUNDATION / VALIDATION PENDING**

Versioned event contracts, transactional PostgreSQL outbox, tenant RLS, dispatcher/worker foundation, and explicit lease/claim state are implemented. No external broker was introduced.

### IMP-020 — JWT Key Rotation / JWKS

**Status: IMPLEMENTED — VALIDATION PENDING**

RS256 is the selected asymmetric algorithm. Key-ring lifecycle, `kid`, JWKS publication, RS256 signing/verification, and opt-in legacy HS256 migration verification are implemented.

### IMP-022 — ESLint + Prettier

**Status: PENDING**

This remains the principal developer-experience implementation gap. It requires adding the formatter/linter packages and lockfile entries, establishing configuration/scripts, and then enabling the lint gate in CI. It has deliberately not been faked by adding configuration files without the corresponding dependency graph.

### IMP-023 — Type-Safe Route Definitions

**Status: PARTIAL**

Runtime request validation is implemented. Full Fastify type-provider inference remains a separate refactor and should be performed incrementally so it does not weaken the existing schemas or tenant/auth boundaries.

### IMP-024 — Test Infrastructure

**Status: PARTIAL / FOUNDATION COMPLETE**

Unit/integration separation, shared fixtures/helpers, transaction/pagination coverage, and the real PostgreSQL integration harness are present. Further standardization is useful but is not required to begin runtime validation.

### IMP-025 — CI/CD Pipeline

**Status: PARTIAL / VALIDATION PIPELINE IMPLEMENTED**

CI performs generated-config drift verification, migration-recovery verification, typecheck, unit tests, backend build, production Docker build, and PostgreSQL 17 integration tests using a non-superuser `NOBYPASSRLS` test role. Remaining work is release/image publishing policy and the lint gate once IMP-022 dependencies are added.

### IMP-027 — Migration Rollback / Recovery

**Status: IMPLEMENTED — GOVERNANCE + CI ENFORCEMENT / VALIDATION PENDING**

Recovery classifications, required recovery manifest, `db:verify-recovery`, and CI enforcement are implemented. Existing migrations were not given unsafe synthetic rollback SQL. Per-migration destructive recovery testing remains intentionally subject to staging/database evidence.

### IMP-028 — Query Performance Monitoring

**Status: IMPLEMENTED — VALIDATION PENDING**

`pg_stat_statements` aggregate monitoring with slow-query thresholds is implemented without exposing raw SQL text or parameters through the application. Runtime extension validation and final operational dashboard/alert integration remain pending.

### IMP-029 — Table Partitioning

**Status: FUTURE — EVIDENCE REQUIRED**

The approved policy is evidence-driven. No blanket partitioning is implemented. Workload, row-growth, query-plan, maintenance, and RLS evidence must justify any future partitioning.

### IMP-030 — API Versioning

**Status: IMPLEMENTED — VALIDATION PENDING**

Explicit `/api/v1` versioning and compatibility/deprecation guidance are documented. Final compatibility validation remains pending.

### IMP-031 — Domain Repository Interfaces

**Status: PARTIAL**

`src/domain/contracts/repositories.ts` is the domain source of truth and identified application-service imports have been migrated. Compatibility re-exports remain in `src/application/contracts/security.ts` where removal would currently create unnecessary churn. A final import audit can be completed during the next type-provider/refactoring pass.

### IMP-032 — Configuration Documentation

**Status: COMPLETED**

Configuration documentation and generated-reference workflow are present. MFA encryption-key documentation has also been added to `.env.example`; the runtime currently reads this deployment secret directly so secret material is not embedded in source.

## Validation boundary

The remaining items are no longer a reason to postpone runtime validation:

1. **IMP-022** is tooling/dependency work and can be completed before or alongside validation.
2. **IMP-023/031** are refactoring/typing improvements and should not be allowed to destabilize the security baseline.
3. **IMP-014/015** concrete providers require deployment-specific credentials and infrastructure.
4. **IMP-029** must remain evidence-driven by ADR decision.
5. Runtime/database evidence is intentionally not represented as completed until executed in VS Code/Copilot against the real PostgreSQL environment.

## Approved ADRs

ADR-0008, ADR-0009, ADR-0014, ADR-0015, ADR-0016, ADR-0017, ADR-0018, ADR-0019, ADR-0020, ADR-0021, ADR-0022, ADR-0023, and ADR-0024 are approved as recorded in `docs/10-adr/README.md`.

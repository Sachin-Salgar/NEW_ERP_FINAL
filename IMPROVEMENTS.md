# NEW_ERP_FINAL — Improvement Backlog

**Generated**: 2026-09-03  
**Source**: Architectural analysis against `docs/` authoritative documentation  
**Status**: Living document — update as items are completed or reprioritized

---

## Executive Summary

This document catalogs all identified improvements for the NEW_ERP_FINAL ERP backend, categorized by priority and mapped to architectural principles from `docs/00-overview/01-architectural-principles.md` and governance rules from `docs/00-overview/02-governance.md`.

**Current State**: Modular monolith with Fastify, TypeScript, PostgreSQL (Drizzle), JWT auth, RLS multi-tenancy. Strong foundation; missing key platform services, observability, and developer experience tooling.

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
- Add `@fastify/swagger` + `@fastify/swagger-ui`
- Generate from Zod schemas (already used in config)
- Expose at `/docs` (UI) and `/docs/json` (spec)
- Include auth flows, error responses, pagination
**Files**: New `src/presentation/http/swagger.ts`, modify `app.ts`
**Effort**: Medium (2-3 days)

### 2. Rate Limiting on Auth Endpoints
**Status**: COMPLETED  
**Principle**: Security by Design (Principle 7)  
**Gap**: `/auth/login`, `/auth/register`, `/auth/refresh` have no rate limits — vulnerable to brute force  
**Implementation**:
- Add `@fastify/rate-limit`
- Config: 5 req/min for login/register, 10 req/min for refresh
- Per-IP + per-tenant keys
- Return `Retry-After` header
**File**: `src/presentation/http/app.ts`
**Effort**: Low (0.5 day)

### 3. Request Validation Pipeline
**Status**: COMPLETED  
**Principle**: Consistency Over Convenience (Principle 9)  
**Gap**: Routes manually parse `request.body as Record<string, unknown>` — no schema validation  
**Implementation**:
- Add `fastify-type-provider-zod` (or `@fastify/zod-provider`)
- Define Zod schemas for all route bodies/query/params
- Automatic 400 responses with field-level errors
- Type-safe `request.body` inference
**Files**: All route files in `src/presentation/http/routes/`, new `src/presentation/http/schemas/`
**Effort**: Medium (2-3 days)

### 4. Audit Logging Foundation
**Status**: BLOCKED — ADR REQUIRED  
**Principle**: Audit Everything Important (Principle 8)  
**Gap**: No audit trail for create/update/delete/approval operations — compliance risk  
**Implementation**:
- **Migration**: Add `audit_log` table (actor, tenant, timestamp, operation, entity_type, entity_id, before_json, after_json, correlation_id, ip_address, user_agent, status)
- **Domain**: `AuditEvent` type, `AuditRepository` interface
- **Infrastructure**: `PostgresAuditRepository` with batch insert
- **Service**: `AuditService.emit(event)` — call from application services
- **Middleware**: Auto-capture correlation_id, IP, user-agent
**ADR Required**: Yes (cross-cutting)
**Files**: Migration, `src/domain/contracts/audit.ts`, `src/application/services/audit-service.ts`, `src/infrastructure/database/repositories/postgres-audit-repository.ts`
**Effort**: High (5-7 days)

---

## P1 — High (Next Sprint)

### 5. Email Verification Flow
**Status**: BLOCKED — ADR REQUIRED  
**Principle**: Backend Owns Business Logic (Principle 1)  
**Gap**: Schema has `emailVerifiedAt`, `passwordResetTokenHash`, `passwordResetExpiresAt` — no API routes  
**Implementation**:
- Routes: `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password`
- Service: `EmailVerificationService`, `PasswordResetService`
- Token generation: crypto-random, hashed storage, 24h expiry
- Email abstraction: `EmailService` interface + stub (real provider later)
**Governance Note**: This changes authentication/recovery flow and depends on a notification/email platform decision. The current governance document requires an approved decision before changing authentication flow or introducing cross-cutting platform services.
**Files**: New routes, services, email abstraction
**Effort**: Medium (3-4 days)

### 6. MFA (TOTP) Implementation
**Status**: BLOCKED — ADR REQUIRED  
**Principle**: Security by Design (Principle 7)  
**Gap**: Schema has `mfaEnabled`, `encryptedMfaSecret` — no enrollment/verification  
**Implementation**:
- Routes: `POST /auth/mfa/enroll` (returns QR code), `POST /auth/mfa/verify`, `POST /auth/mfa/disable`
- Service: `TotpService` using `otplib` (RFC 6238)
- Encryption: AES-GCM for secret at rest (use `crypto` built-in)
- Recovery codes: generate 10, store hashed
**Governance Note**: MFA/session/authentication strategy is explicitly ADR-governed in `docs/00-overview/02-governance.md`.
**Files**: New routes, `src/infrastructure/security/totp-service.ts`
**Effort**: Medium (3-4 days)

### 7. Soft Delete Consistency Audit
**Status**: COMPLETED  
**Principle**: Database Is the Single Source of Truth (Principle 3)  
**Gap**: Some repository methods don't filter `is_deleted = false` (e.g., `listRoles`, `listPermissions`)  
**Implementation**:
- Audit all 50+ repository methods in `PostgresPlatformRepository`
- Add `.where(sql\`${table.isDeleted} = false\`)` where missing
- Add unit test verifying soft-delete filtering
**File**: `src/infrastructure/database/repositories/postgres-platform-repository.ts`
**Effort**: Low (1 day)

### 8. Enhanced Health Check Endpoint
**Status**: COMPLETED  
**Principle**: Observability (DevOps)  
**Gap**: `/health` returns only `{ status: 'ok' }` — no DB, migration, dependency status  
**Implementation**:
- Extend `GET /health` with:
  - `database`: `{ connected: boolean, latencyMs: number, pool: { used, free, pending } }`
  - `migrations`: `{ applied: string[], pending: string[] }`
  - `uptime`: seconds
  - `memory`: RSS, heap used
- Add `GET /health/live` (k8s liveness) and `GET /health/ready` (readiness)
**File**: `src/presentation/http/routes/health.ts`
**Effort**: Low (0.5 day)

---

## P2 — Medium (Within 2 Sprints)

### 9. Transaction Support (Unit of Work)
**Status**: PARTIAL  
**Principle**: Backend Owns Business Logic (Principle 1)  
**Gap**: Multi-table operations (e.g., `bootstrapTenant`) lack explicit transaction boundaries  
**Implementation**:
- `UnitOfWork` class: `begin()`, `commit()`, `rollback()`, `runInTransaction(fn)`
- Repository methods accept optional `client` parameter (already partially supported via `withTenantContext`)
- Use in `TenantBootstrapService`, `UserRegistrationService`, future business modules
**Current Note**: `withTenantContext` already provides BEGIN/COMMIT/ROLLBACK and tenant-local RLS context, and critical repository operations such as tenant bootstrap are atomic. The remaining work is to move transaction coordination to the application/service boundary without weakening RLS or creating nested/competing transactions.
**File**: New `src/infrastructure/database/unit-of-work.ts`
**Effort**: Medium (2-3 days)

### 10. RFC 7807 Problem Details Error Format
**Status**: COMPLETED  
**Principle**: Consistency Over Convenience (Principle 9)  
**Gap**: Custom error format; not interoperable  
**Implementation**:
- Response: `application/problem+json` with `type`, `title`, `status`, `detail`, `instance`, `errors[]`
- Map existing `AppError` subclasses to standard types
- Keep backward compatibility via `Accept` header negotiation
**Verification Note**: Problem Details is opt-in only for explicit `Accept: application/problem+json`; absent or wildcard `Accept` preserves the existing error envelope for backward compatibility. Unit coverage protects both representations.
**File**: `src/infrastructure/http/error-handler.ts`
**Effort**: Low (1 day)

### 11. Correlation ID Propagation
**Status**: COMPLETED  
**Principle**: Audit Everything Important (Principle 8)  
**Gap**: Request ID generated but not propagated across async boundaries (DB queries, external calls)  
**Implementation**:
- Middleware: Generate/extract `x-correlation-id`, store in `AsyncLocalStorage`
- Logger: Auto-include correlation ID in all log lines
- HTTP client: Forward header to downstream services
- DB: Include in audit log
**Files**: `src/infrastructure/logging/logger.ts`, new middleware, `src/infrastructure/http/client.ts`
**Effort**: Medium (2 days)

### 12. Fix `organization_modules` Schema Gap
**Status**: COMPLETED  
**Principle**: Database First Philosophy (Principle 5)  
**Gap**: `bootstrapTenant` inserts into `organization_modules` (line 1122) but table missing from `schema.ts`  
**Implementation**:
- Add `organizationModules` table to `schema.ts` (mirror `tenant_modules` with `organization_id`)
- Generate migration `0007_organization_modules.sql`
- Verify bootstrap works
**Files**: `src/infrastructure/database/schema.ts`, new migration
**Effort**: Low (0.5 day)

### 13. Pagination on List Endpoints
**Status**: PENDING — SPEC ALIGNMENT REQUIRED  
**Principle**: Consistency Over Convenience (Principle 9)  
**Gap**: No pagination on `/auth/modules`, `/rbac/roles`, `/rbac/permissions`, etc.  
**Implementation**:
- Standard params: `page` (1-based), `limit` (max 100), `cursor` (opaque string for keyset)
- Response envelope: `{ data: T[], meta: { page, limit, total, nextCursor } }`
- Apply to all `GET` list routes
**Authoritative Documentation Note**: `docs/04-backend/06-api-design-standards.md` currently defines `page`, `page_size`, `sort`, `order`, and `search`; implementation must follow or formally reconcile that API contract rather than introducing a conflicting `limit`/`cursor` convention silently.
**Files**: Route files, shared pagination helper
**Effort**: Low (1 day)

---

## P3 — Platform Services (Require ADR)

> **Governance Note**: Per `docs/00-overview/02-governance.md` § "Architectural Governance" and Principle 5 (Platform Before Features), these foundational services require Architecture Review Board approval and an approved ADR before implementation.

### 14. Notification Service
**Status**: BLOCKED — ADR REQUIRED  
**Principle**: Platform Before Features (Principle 5)  
**Scope**: Email, SMS, push, in-app notifications  
**Interface**: `NotificationService.send({ tenantId, userId, channel, templateId, params })`  
**Providers**: SendGrid, Twilio, Firebase (pluggable)  
**ADR**: Define channel abstraction, template system, delivery guarantees  
**Effort**: High (2 weeks)

### 15. File Storage Service
**Status**: BLOCKED — ADR REQUIRED  
**Principle**: Platform Before Features (Principle 5)  
**Scope**: Upload, download, signed URLs, metadata, virus scan  
**Interface**: `FileStorageService.put(key, stream)`, `get(key)`, `signUrl(key, ttl)`  
**Providers**: S3, MinIO, Azure Blob, local FS  
**ADR**: Define path structure, tenant isolation, retention policy  
**Effort**: High (2 weeks)

### 16. Scheduler Service
**Status**: BLOCKED — ADR REQUIRED  
**Principle**: Platform Before Features (Principle 5)  
**Scope**: Recurring jobs (FY closure, session cleanup, audit retention, report generation)  
**Interface**: `SchedulerService.schedule(cron, jobId, handler)`, `trigger(jobId)`  
**Backend**: In-memory (dev), Redis + BullMQ (prod)  
**ADR**: Define job idempotency, monitoring, failure handling  
**Effort**: Medium (1 week)

### 17. Event-Driven Architecture (Domain Events)
**Status**: BLOCKED — ADR REQUIRED  
**Principle**: Modular Monolith (Principle 4) — explicit in `docs/02-architecture/README.md` as "Deferred where explicitly marked TBD/Proposed"  
**Scope**: Cross-module communication without direct dependencies  
**Interface**: `EventBus.publish(event)`, `subscribe(eventType, handler)`  
**ADR**: Define event schema, ordering, exactly-once vs at-least-once, saga patterns  
**Effort**: High (3 weeks)

---

## P4 — Security Hardening & Future-Proofing

### 18. Account Lockout After Failed Attempts
**Status**: COMPLETED  
**Principle**: Security by Design (Principle 7)  
**Gap**: Schema has `failedLoginCount`, `lockedUntil` — no enforcement logic  
**Implementation**:
- Config: `MAX_FAILED_ATTEMPTS=5`, `LOCKOUT_DURATION_MINUTES=15`
- Increment on failed login, reset on success
- Return `423 Locked` with `Retry-After`
**File**: `src/application/services/authentication-service.ts`
**Effort**: Low (0.5 day)

### 19. Password Policy Enforcement
**Status**: COMPLETED  
**Principle**: Security by Design (Principle 7)  
**Gap**: No complexity requirements on registration/password change  
**Implementation**:
- Configurable policy: `minLength`, `requireUppercase`, `requireLowercase`, `requireNumber`, `requireSymbol`, `maxAgeDays`, `historyCount`
- Validate in `UserRegistrationService`, `AuthenticationService.changePassword`
- Return field-level errors
**File**: `src/application/services/user-registration-service.ts`, new `password-policy.ts`
**Effort**: Low (1 day)

### 20. JWT Key Rotation (JWKS)
**Status**: BLOCKED — ADR REQUIRED  
**Principle**: Security by Design (Principle 7)  
**Gap**: Single `JWT_SECRET` — no rotation, no `kid` in header  
**Implementation**:
- Generate RSA key pair (RS256) on startup or load from vault
- Store active + previous key for rotation window
- Expose `GET /.well-known/jwks.json`
- Sign with `kid` header; verify against JWKS
**Governance Note**: Changing token signing mechanism, verification flow, and key-management strategy is an authentication/security architecture decision and requires an approved ADR.
**File**: `src/infrastructure/security/jwt-token-service.ts`, new route
**Effort**: Medium (2 days)

### 21. Request Size Limits
**Status**: COMPLETED  
**Principle**: Security by Design (Principle 7)  
**Gap**: No body size limit — DoS risk  
**Implementation**:
- Global: 1MB (Fastify default)
- Per-route: 10KB for auth, 5MB for file upload (future)
- Return `413 Payload Too Large`
**File**: `src/presentation/http/app.ts`
**Effort**: Low (0.5 day)

---

## Code Quality & Developer Experience

### 22. ESLint + Prettier
**Status**: PENDING  
**Principle**: Consistency Over Convenience (Principle 9)  
**Gap**: No linting/formatting enforcement  
**Implementation**:
- `eslint.config.js` with `@typescript-eslint`, `prettier`
- `.prettierrc` matching project style
- `npm run lint`, `npm run format`
- Pre-commit hook via `husky` (optional)
**Files**: Config files at root
**Effort**: Low (0.5 day)

### 23. Type-Safe Route Definitions
**Status**: PARTIAL  
**Principle**: Consistency Over Convenience (Principle 9)  
**Gap**: Manual body parsing loses type safety  
**Implementation**:
- Use `fastify-type-provider-zod` for end-to-end inference
- Define schemas in `src/presentation/http/schemas/*.ts`
- Routes import schemas; `request.body` fully typed
**Current Note**: Runtime validation and unsafe route casts have been substantially removed by IMP-003, but end-to-end Fastify type-provider inference is not yet implemented.
**Files**: Route files, new schema files
**Effort**: Medium (2 days) — overlaps with P0 #3

### 24. Test Infrastructure Improvements
**Status**: PARTIAL  
**Principle**: Documentation Is Part of the Product (Principle 10) — tests are executable documentation  
**Gap**: Duplicated bootstrap logic, hardcoded ports/secrets, no testcontainers  
**Implementation**:
- `tests/fixtures/`: Reusable tenant/org/user factories
- `tests/helpers/`: `createTestApp()`, `bootstrapTestTenant()`, `cleanupTestData()`
- `vitest.config.ts`: Global setup/teardown, testcontainers for PostgreSQL
- Separate unit vs integration test configs
**Current Note**: Unit and integration Vitest configurations are now separate, `npm test` executes both explicitly, and plain `vitest` defaults to database-independent unit tests. Shared factories/helpers and optional testcontainers remain.
**Files**: `tests/`, `vitest.config.ts`
**Effort**: Medium (2-3 days)

### 25. CI/CD Pipeline
**Status**: PARTIAL  
**Principle**: DevOps (Documentation Domain)  
**Gap**: No automated validation  
**Implementation**:
- GitHub Actions workflow: `.github/workflows/ci.yml`
- Jobs: `typecheck` → `lint` → `test:unit` → `test:integration` → `build` → `docker`
- Integration tests spin up PostgreSQL via service container
- Publish Docker image on tag
**Current Note**: `.github/workflows/backend-ci.yml` now runs generated-config drift verification, typecheck, unit tests, backend build, Docker build, and PostgreSQL 17 integration tests using a non-superuser `NOBYPASSRLS` role. Lint awaits IMP-022 and image publishing on tags remains to be added when registry/release policy is defined.
**File**: `.github/workflows/backend-ci.yml`
**Effort**: Medium (1-2 days)

### 26. Production Dockerfile
**Status**: COMPLETED  
**Principle**: DevOps (Documentation Domain)  
**Gap**: No containerization  
**Implementation**:
- Multi-stage: `builder` (npm ci, build) → `runtime` (node:alpine, non-root user, dist only)
- Health check endpoint
- `.dockerignore`
**Verification Note**: Backend CI successfully built the production Docker image on `feat/improvements`.
**Files**: `Dockerfile`, `.dockerignore`
**Effort**: Low (0.5 day)

---

## Database & Migration Improvements

### 27. Migration Rollback Strategy
**Status**: PARTIAL  
**Principle**: Database First Philosophy (Principle 5)  
**Gap**: `drizzle-kit generate` + up-only migrations  
**Implementation**:
- Document rollback procedure per migration
- Add `down` SQL where feasible (non-destructive)
- Test rollback in CI
**Current Note**: `docs/03-database/20-migration-recovery-procedure.md` now operationalizes approved ADR-0007 with recovery classification, required review records, application rollback vs compensating migration guidance, RLS/security verification, and CI/staging expectations. Existing migrations have not been given unsafe synthetic `down` scripts; per-migration automated recovery tests remain future work where genuinely non-destructive.
**Files**: Migration files, `docs/03-database/20-migration-recovery-procedure.md`
**Effort**: Medium (ongoing)

### 28. Query Performance Monitoring
**Status**: BLOCKED — ADR REQUIRED  
**Principle**: Observability (DevOps)  
**Gap**: No `pg_stat_statements`, no slow query logging  
**Implementation**:
- Enable `pg_stat_statements` extension in migration
- Log queries > 100ms with correlation ID
- Add `/admin/queries/slow` endpoint (admin only)
**Governance Note**: Observability standards and cross-cutting logging/monitoring architecture are explicitly governance-controlled and currently unresolved. Do not add a platform-wide query-observability mechanism without an approved decision.
**Files**: Migration, logging middleware
**Effort**: Low (1 day)

### 29. Table Partitioning Strategy (Future)
**Status**: BLOCKED — ADR REQUIRED  
**Principle**: Database First Philosophy (Principle 5)  
**Target Tables**: `user_sessions`, `audit_log` (when added)  
**Strategy**: Partition by `tenant_id` + time (monthly) via `pg_partman`  
**ADR Required**: Yes  
**Effort**: High (when data volume justifies)

---

## Cross-Cutting Concerns

### 30. API Versioning Strategy
**Status**: BLOCKED — ADR REQUIRED  
**Principle**: API-First Development (Principle 4)  
**Current**: `/api/v1` hardcoded  
**Decision Needed**: URL versioning (`/api/v2`) vs header (`Accept: application/vnd.erp.v2+json`)  
**Policy**: Deprecation timeline, sunset headers, migration guide  
**ADR Required**: Yes  
**Effort**: Low (documentation)

### 31. Repository Interfaces in Domain Layer
**Status**: PARTIAL  
**Principle**: Separation of Concerns (Principle 7)  
**Current**: Repository interfaces historically lived in `src/application/contracts/security.ts` (application layer)  
**Better**: Move to `src/domain/contracts/` — repositories are domain contracts  
**Current Note**: Repository interfaces and records now have their source of truth in `src/domain/contracts/repositories.ts`; `src/application/contracts/security.ts` retains compatibility re-exports while remaining import sites are migrated incrementally. Typecheck/build have validated the new domain contract boundary.
**Files**: `src/domain/contracts/repositories.ts`, update remaining imports across codebase
**Effort**: Low (1 day)

### 32. Configuration Documentation
**Status**: COMPLETED  
**Principle**: Documentation Is Part of the Product (Principle 10)  
**Gap**: No generated config reference  
**Implementation**:
- Script to extract Zod schema → Markdown table
- Include in `docs/07-devops/` or `docs/04-backend/`
**Verification Note**: `npm run docs:config` generates `docs/04-backend/configuration-reference.md` from `src/config/schema.ts`; CI fails on generated-document drift. `.env.example` is synchronized with the current schema/security configuration.
**Effort**: Low (0.5 day)

---

## Tracking

| ID | Title | Priority | Status | Owner | Target | ADR Required |
|----|-------|----------|--------|-------|--------|--------------|
| IMP-001 | OpenAPI/Swagger Documentation | P0 | **Completed** | — | Sprint 1 | No |
| IMP-002 | Rate Limiting on Auth | P0 | **Completed** | — | Sprint 1 | No |
| IMP-003 | Request Validation (Zod) | P0 | **Completed** | — | Sprint 1 | No |
| IMP-004 | Audit Logging Foundation | P0 | **Blocked — ADR Required** | — | Sprint 2 | **Yes** |
| IMP-005 | Email Verification Flow | P1 | **Blocked — ADR Required** | — | Sprint 2 | **Yes** |
| IMP-006 | MFA (TOTP) | P1 | **Blocked — ADR Required** | — | Sprint 2 | **Yes** |
| IMP-007 | Soft Delete Consistency | P1 | **Completed** | — | Sprint 2 | No |
| IMP-008 | Enhanced Health Check | P1 | **Completed** | — | Sprint 1 | No |
| IMP-009 | Unit of Work / Transactions | P2 | **Partial** | — | Sprint 3 | No |
| IMP-010 | RFC 7807 Error Format | P2 | **Completed** | — | Sprint 3 | No |
| IMP-011 | Correlation ID Propagation | P2 | **Completed** | — | Sprint 3 | No |
| IMP-012 | Fix organization_modules Schema | P2 | **Completed** | — | Sprint 2 | No |
| IMP-013 | Pagination on List Endpoints | P2 | **Pending — Spec Alignment Required** | — | Sprint 3 | No |
| IMP-014 | Notification Service | P3 | **Blocked — ADR Required** | — | TBD | **Yes** |
| IMP-015 | File Storage Service | P3 | **Blocked — ADR Required** | — | TBD | **Yes** |
| IMP-016 | Scheduler Service | P3 | **Blocked — ADR Required** | — | TBD | **Yes** |
| IMP-017 | Event-Driven Architecture | P3 | **Blocked — ADR Required** | — | TBD | **Yes** |
| IMP-018 | Account Lockout | P4 | **Completed** | — | Sprint 3 | No |
| IMP-019 | Password Policy | P4 | **Completed** | — | Sprint 3 | No |
| IMP-020 | JWT Key Rotation (JWKS) | P4 | **Blocked — ADR Required** | — | Sprint 4 | **Yes** |
| IMP-021 | Request Size Limits | P4 | **Completed** | — | Sprint 2 | No |
| IMP-022 | ESLint + Prettier | P3 | Pending | — | Sprint 2 | No |
| IMP-023 | Type-Safe Routes | P3 | **Partial** | — | Sprint 3 | No |
| IMP-024 | Test Infrastructure | P3 | **Partial** | — | Sprint 2 | No |
| IMP-025 | CI/CD Pipeline | P3 | **Partial** | — | Sprint 2 | No |
| IMP-026 | Production Dockerfile | P3 | **Completed** | — | Sprint 2 | No |
| IMP-027 | Migration Rollback Strategy | P4 | **Partial** | — | Ongoing | No |
| IMP-028 | Query Performance Monitoring | P4 | **Blocked — ADR Required** | — | Sprint 3 | **Yes** |
| IMP-029 | Table Partitioning | P4 | **Blocked — ADR Required** | — | Future | **Yes** |
| IMP-030 | API Versioning Strategy | P4 | **Blocked — ADR Required** | — | TBD | **Yes** |
| IMP-031 | Domain Layer Repository Interfaces | P2 | **Partial** | — | Sprint 3 | No |
| IMP-032 | Configuration Documentation | P4 | **Completed** | — | Sprint 3 | No |

---

## Governance Compliance Checklist

- [ ] All P3 items have ADR drafted and submitted to Architecture Review Board
- [x] No implementation begins on ADR-gated items without approved ADR
- [x] P0/P1 implementation is checked against approved ADRs and authoritative governance before changes
- [ ] Security changes (P0, P1, P4) reviewed by Security Architect
- [x] Database changes (migrations) follow `docs/03-database/` standards
- [x] Documentation updated alongside implementation (Principle 10)

---

## Next Steps

1. Complete IMP-009 by moving transaction ownership to the application/service boundary without weakening `SET LOCAL` tenant context or PostgreSQL RLS.
2. Reconcile IMP-013 pagination wording with the authoritative API standard before changing public list contracts.
3. Complete remaining non-governed DX work (IMP-022, IMP-023, IMP-024, IMP-025, IMP-031) in small verified batches.
4. Draft/approve ADRs for items marked `Blocked — ADR Required` before implementation.
5. Update this document after each completion.

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

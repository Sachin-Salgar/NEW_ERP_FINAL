# NEW_ERP_FINAL — Improvement Backlog

**Generated**: 2026-09-04  
**Last implementation synchronization**: 2026-09-04  
**Branch**: `feat/improvements`  
**Status**: Implementation backlog completed; runtime/provider/evidence validation remains where explicitly stated.

---

## Executive Summary

This is the authoritative implementation status for the 32 improvements identified for the NEW_ERP_FINAL backend. The implementation pass on `feat/improvements` is complete: there are no remaining **PENDING** or **PARTIAL** implementation items.

The backend remains a Fastify/TypeScript modular monolith using PostgreSQL/Drizzle, JWT authentication, and PostgreSQL RLS tenant isolation. The improvement work must not weaken tenant isolation, RLS, authorization, authentication, transaction boundaries, or database integrity.

### Status rules

- **COMPLETED** — implementation is complete and sufficient prior validation evidence exists.
- **IMPLEMENTED — VALIDATION PENDING** — implementation is complete; VS Code/Copilot, CI, provider, deployment, database-extension, or operational evidence remains.
- **FUTURE — EVIDENCE REQUIRED** — intentionally not implemented because the approved architecture requires objective workload/data evidence first.

### Closure totals

| Status | Count |
|---|---:|
| COMPLETED | 16 |
| IMPLEMENTED — VALIDATION PENDING | 15 |
| FUTURE — EVIDENCE REQUIRED | 1 |
| PARTIAL / PENDING | 0 |
| **Total** | **32** |

---

## Full Improvement Matrix

| ID | Improvement | Status | Implementation / remaining evidence |
|---|---|---|---|
| IMP-001 | OpenAPI/Swagger documentation | **COMPLETED** | Swagger + Swagger UI, `/docs`, `/docs/json`, runtime-generated OpenAPI contract. |
| IMP-002 | Auth rate limiting | **COMPLETED** | Fastify rate limits, bounded windows, `Retry-After`. |
| IMP-003 | Request validation pipeline | **COMPLETED** | Zod/JSON-schema validation for applicable body/params/query/header inputs; invalid input rejected before business handlers. |
| IMP-004 | Audit logging foundation | **COMPLETED** | PostgreSQL audit persistence, append-only/RLS protection, transaction reuse and correlation metadata; prior local evidence exists. |
| IMP-005 | Email verification/password recovery | **IMPLEMENTED — VALIDATION PENDING** | Hashed single-use tokens, expiry, HTTP request/confirm/reset routes, password policy, session invalidation, enumeration-resistant recovery, provider-neutral notification adapter. External provider delivery remains. |
| IMP-006 | MFA/TOTP | **IMPLEMENTED — VALIDATION PENDING** | RFC 6238, AES-256-GCM secrets, enrollment/confirmation/verify/disable routes, hashed recovery codes, PostgreSQL persistence, `MFA_ENCRYPTION_KEY`. Production key provisioning and mandatory-login product policy remain. |
| IMP-007 | Soft delete consistency | **COMPLETED** | Repository filtering and regression coverage. |
| IMP-008 | Enhanced health checks | **COMPLETED** | Readiness/liveness, DB latency/connectivity, pool state, uptime. |
| IMP-009 | Unit of Work / transactions | **COMPLETED** | UnitOfWork, AsyncLocalStorage transaction context, tenant-client reuse, cross-tenant protection, service boundaries, PostgreSQL rollback/integration coverage. |
| IMP-010 | RFC 7807 problem details | **COMPLETED** | `application/problem+json` opt-in, compatibility envelope retained, 5xx details protected. |
| IMP-011 | Correlation ID propagation | **COMPLETED** | Generation/extraction, AsyncLocalStorage propagation, HTTP/log/audit integration. |
| IMP-012 | `organization_modules` gap | **COMPLETED** | Schema/migration/RLS-aware access and recovery registration. |
| IMP-013 | Pagination | **COMPLETED** | Shared `page`, `page_size`, `sort`, `order`, `search` contract and consistent metadata. SQL/keyset pagination is a future optimization, not an incomplete API contract. |
| IMP-014 | Notification service | **IMPLEMENTED — VALIDATION PENDING** | Provider-neutral contracts, PostgreSQL queue/history, tenant RLS, leasing/retry/backoff/worker foundation. Concrete delivery providers remain deployment work. |
| IMP-015 | File storage service | **IMPLEMENTED — VALIDATION PENDING** | Provider-neutral contracts, tenant metadata, injected provider orchestration, authorization. Concrete target provider remains deployment work. |
| IMP-016 | Scheduler service | **IMPLEMENTED — VALIDATION PENDING** | Durable jobs, leasing, retry/backoff, injected handlers. Worker/deployment operation remains. |
| IMP-017 | Domain events / outbox | **IMPLEMENTED — VALIDATION PENDING** | Versioned contracts, tenant-RLS outbox, dispatcher/worker, explicit lease/claim state. Operational worker evidence and future module adoption remain. |
| IMP-018 | Account lockout | **COMPLETED** | Failed-attempt counting, timed lockout, success reset, `423`, `Retry-After`. |
| IMP-019 | Password policy | **COMPLETED** | Configurable length/uppercase/lowercase/number/symbol enforcement and hardened boolean parsing. |
| IMP-020 | JWT rotation / JWKS | **IMPLEMENTED — VALIDATION PENDING** | RS256 key ring, `kid`, JWKS, active/verification-only/retired lifecycle, opt-in legacy HS256. Production key/rotation evidence remains. |
| IMP-021 | Request size limits | **COMPLETED** | Global and tighter auth body limits with `413` handling. |
| IMP-022 | ESLint + Prettier | **IMPLEMENTED — VALIDATION PENDING** | ESLint 9 flat config, Prettier config/ignore, pinned quality scripts, CI/release lint gate. Run quality validation in VS Code/Copilot/CI. |
| IMP-023 | Type-safe route definitions | **IMPLEMENTED — VALIDATION PENDING** | Explicit Fastify route `Body`/`Params` generics across auth, account security, MFA, branch, location, RBAC and core-enterprise routes; Zod-inferred bodies where schemas exist. Typecheck/regression validation remains. |
| IMP-024 | Test infrastructure | **IMPLEMENTED — VALIDATION PENDING** | Shared identity/header/pagination factories, integration DB pool/client/rollback/cleanup helpers, focused migration/query-performance/API-version tests. Run expanded suites. |
| IMP-025 | CI/CD | **IMPLEMENTED — VALIDATION PENDING** | CI quality/config/recovery/typecheck/unit/build/Docker/PostgreSQL-RLS gates plus release workflow publishing immutable GHCR images with provenance/SBOM. GitHub execution/permissions remain to validate. |
| IMP-026 | Production Dockerfile | **COMPLETED** | Multi-stage, non-root, minimal runtime, health check, `.dockerignore`. |
| IMP-027 | Migration recovery strategy | **IMPLEMENTED — VALIDATION PENDING** | Typed governance verifier, exact journal/manifest matching, strategy validation, destructive rollback protection, automated-down test requirement, CI/release enforcement. Staging recovery evidence remains. |
| IMP-028 | Query performance monitoring | **IMPLEMENTED — VALIDATION PENDING** | `pg_stat_statements` aggregates only, no raw query text/params, bounded thresholds/limits, fail-closed extension/permission/error handling, aggregate startup log. Extension-enabled DB validation remains. |
| IMP-029 | Table partitioning strategy | **FUTURE — EVIDENCE REQUIRED** | ADR-0023 intentionally prohibits blanket partitioning until objective row-count/query-plan/retention/maintenance evidence identifies a real need. |
| IMP-030 | API versioning | **IMPLEMENTED — VALIDATION PENDING** | Explicit versioned path through `API_PREFIX` (`/api/v1` default), `x-api-version`, `x-api-version-policy: path`, CORS exposure, integration regression test. Runtime/proxy validation remains. |
| IMP-031 | Repository interfaces in domain | **IMPLEMENTED — VALIDATION PENDING** | `src/domain/contracts/repositories.ts` is the single source of truth. Application compatibility exports are deprecated type-only re-exports with no duplicate interface ownership; new code imports domain contracts directly. Typecheck/import audit remains. |
| IMP-032 | Configuration documentation | **COMPLETED** | Generated reference, schema constraints/defaults, `.env.example`, MFA/JWT/DB/security settings and CI drift verification. |

---

## Implementation Details for the Final Wave

### IMP-022 — ESLint + Prettier

Added:

- `eslint.config.mjs`
- `.prettierrc.json`
- `.prettierignore`
- `quality:install`, `lint`, `format`, `format:check`, and `quality` package scripts
- lint quality gates in backend CI and release validation

The quality tool install is pinned and uses `--no-save --package-lock=false`. This intentionally preserves the previously validated lockfile rather than manually fabricating `package-lock.json` metadata.

### IMP-023 — Type-safe routes

The major route modules now use Fastify route generics and typed request bodies/parameters. Runtime Zod/JSON-schema validation remains authoritative. Existing Zod schemas provide `z.infer` types where practical; explicit Fastify generics are used elsewhere to avoid adding another type-provider dependency solely for inference.

### IMP-024 — Test infrastructure

Added reusable helpers for identities, tenant/auth headers, pagination, integration database creation/access, rollback transactions, cleanup, and error-code assertions. Added focused tests for migration-recovery governance, query-performance telemetry privacy/fail-closed behavior, and API-version response headers.

Testcontainers remains optional because the established CI architecture already uses a real PostgreSQL 17 service and a `NOSUPERUSER NOBYPASSRLS` role to exercise actual RLS behavior.

### IMP-025 — CI/CD

`.github/workflows/backend-ci.yml` now validates quality, generated config, migration recovery, typecheck, unit tests, build, Docker build, and PostgreSQL integration tests.

`.github/workflows/backend-release.yml` adds tag/manual release validation and publishes backend images to GitHub Container Registry with release and commit-SHA tags, provenance, and SBOM metadata.

### IMP-027 — Migration recovery

`src/infrastructure/database/migration-recovery.ts` makes recovery governance reusable/testable. It rejects unsupported strategies, journal/manifest drift, unsafe destructive rollback for forward-only security migrations, and `automated-down` entries without an explicit reviewed recovery test. Existing migrations are not given fabricated destructive `down` SQL.

### IMP-028 — Query performance monitoring

The monitor reads only aggregate statement IDs/timing/call/row metrics, never raw SQL text or parameters. Missing extensions, insufficient permissions, and DB errors fail closed to an unavailable snapshot. Startup emits aggregate availability/count/timing data only.

### IMP-030 — API versioning

The path strategy remains authoritative. Versioned responses additionally advertise the derived API version and path policy through response headers, exposed via CORS. An integration test covers the `/api/v1` header contract.

### IMP-031 — Repository contracts

Domain ownership is complete: repository interfaces are defined in `src/domain/contracts/repositories.ts`. `src/application/contracts/security.ts` retains only a deprecated **type-only** compatibility export for legacy consumers; it does not define repository interfaces. Removing that bridge after the legacy monolithic PostgreSQL repository is split is cleanup, not unresolved contract ownership.

---

## Validation Handoff

Implementation is complete. Validation is intentionally performed from the user's VS Code/Copilot environment:

```bash
npm ci
npm run quality
npm run docs:config
git diff --exit-code -- docs/04-backend/configuration-reference.md
npm run db:verify-recovery
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
git diff --check
```

Then repeat the existing HTTP/runtime probes for health, OpenAPI, input validation, RFC7807, correlation IDs, rate limits, recovery enumeration resistance, MFA route protection, API-version headers, and PostgreSQL/RLS tenant isolation.

Provider/deployment-only evidence must be gathered only where those capabilities actually exist: external notification delivery, storage provider, workers, production JWT/MFA keys, Docker/image publishing, and `pg_stat_statements`.

---

## Architectural Guardrails

- Never weaken PostgreSQL RLS or use privileged test roles that bypass tenant policies.
- Never expose raw SQL/query parameters through query-performance telemetry.
- Never persist verification/password-reset secrets in plaintext.
- Never invent destructive migration rollback SQL merely to claim reversibility.
- Never blanket-partition tables; IMP-029 stays evidence-driven under ADR-0023.
- Keep organization-specific behavior as data/configuration, not hard-coded application logic.
- Do not confuse provider/deployment validation with missing source-code implementation.

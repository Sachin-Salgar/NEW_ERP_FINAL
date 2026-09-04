# Improvement Implementation Status — 2026-09-04

**Branch**: `feat/improvements`  
**Scope**: IMP-001 through IMP-032 from `/IMPROVEMENTS.md`  
**Implementation state**: Complete. No backlog item remains `PENDING` or `PARTIAL`. Runtime/provider/deployment evidence is tracked separately.

---

## Status Model

- **COMPLETED** — implementation is complete and prior validation evidence is sufficient.
- **IMPLEMENTED — VALIDATION PENDING** — implementation is complete; VS Code/Copilot, CI, provider, database-extension, or deployment evidence remains.
- **FUTURE — EVIDENCE REQUIRED** — intentionally deferred by approved architecture until objective evidence exists.

This distinction is intentional. Provider credentials, production keys, deployment topology, Docker availability, PostgreSQL extensions, and product-policy decisions are not fabricated in source code merely to remove a validation label.

---

## Closure Matrix

| ID | Improvement | Implementation status | Remaining evidence |
|---|---|---|---|
| IMP-001 | OpenAPI/Swagger | COMPLETED | None |
| IMP-002 | Auth rate limiting | COMPLETED | None |
| IMP-003 | Request validation | COMPLETED | None |
| IMP-004 | Audit logging foundation | COMPLETED | None |
| IMP-005 | Email verification/password recovery | IMPLEMENTED — VALIDATION PENDING | External provider delivery |
| IMP-006 | MFA/TOTP | IMPLEMENTED — VALIDATION PENDING | Production key provisioning; mandatory-login product decision |
| IMP-007 | Soft delete consistency | COMPLETED | None |
| IMP-008 | Enhanced health checks | COMPLETED | None |
| IMP-009 | Unit of Work/transactions | COMPLETED | None |
| IMP-010 | RFC 7807 | COMPLETED | None |
| IMP-011 | Correlation IDs | COMPLETED | None |
| IMP-012 | `organization_modules` | COMPLETED | None |
| IMP-013 | Pagination | COMPLETED | SQL/keyset optimization is future performance work |
| IMP-014 | Notification service | IMPLEMENTED — VALIDATION PENDING | Concrete provider/worker operation |
| IMP-015 | File storage | IMPLEMENTED — VALIDATION PENDING | Concrete deployment provider |
| IMP-016 | Scheduler | IMPLEMENTED — VALIDATION PENDING | Worker operation |
| IMP-017 | Domain events/outbox | IMPLEMENTED — VALIDATION PENDING | Worker operation and future module adoption |
| IMP-018 | Account lockout | COMPLETED | None |
| IMP-019 | Password policy | COMPLETED | None |
| IMP-020 | JWT rotation/JWKS | IMPLEMENTED — VALIDATION PENDING | Production key/rotation evidence |
| IMP-021 | Request size limits | COMPLETED | None |
| IMP-022 | ESLint + Prettier | IMPLEMENTED — VALIDATION PENDING | Run quality gate |
| IMP-023 | Type-safe routes | IMPLEMENTED — VALIDATION PENDING | Typecheck/route regressions |
| IMP-024 | Test infrastructure | IMPLEMENTED — VALIDATION PENDING | Run expanded suites |
| IMP-025 | CI/CD | IMPLEMENTED — VALIDATION PENDING | GitHub Actions/registry execution |
| IMP-026 | Production Dockerfile | COMPLETED | Local Docker optional; CI build is authoritative |
| IMP-027 | Migration recovery | IMPLEMENTED — VALIDATION PENDING | Unit/CI/staging recovery evidence |
| IMP-028 | Query performance monitoring | IMPLEMENTED — VALIDATION PENDING | `pg_stat_statements` deployment validation |
| IMP-029 | Partitioning | FUTURE — EVIDENCE REQUIRED | Objective workload/data evidence |
| IMP-030 | API versioning | IMPLEMENTED — VALIDATION PENDING | Runtime/proxy header validation |
| IMP-031 | Domain repository interfaces | IMPLEMENTED — VALIDATION PENDING | Typecheck/import audit |
| IMP-032 | Configuration documentation | COMPLETED | None |

---

## Newly Closed Implementation Work

### Quality tooling — IMP-022

The branch now contains:

- `eslint.config.mjs` using ESLint 9 flat configuration.
- `.prettierrc.json` and `.prettierignore`.
- Pinned lint/format tooling scripts in `package.json`.
- A quality gate wired into backend CI and release validation.
- Tool installation that deliberately does not modify `package-lock.json`, preserving reproducible `npm ci` behavior from the previously validated baseline.

### Type-safe routes — IMP-023

Major route modules now declare explicit Fastify `Body` and `Params` contracts rather than reading broadly cast request objects:

- authentication/context/module routes
- account-security routes
- MFA routes
- branch routes
- location routes
- RBAC routes
- organization/branch/user enterprise routes

Existing Zod/JSON schemas remain the runtime validation boundary. Where Zod schemas already exist, route body types are inferred from the schema.

### Test infrastructure — IMP-024

Reusable helpers now cover:

- deterministic tenant/organization/branch/location/user identities
- tenant/auth headers
- pagination inputs
- error-code assertions
- integration database URL resolution and pool creation
- scoped clients
- rollback transactions
- standardized pool cleanup

Additional regression coverage was added for migration recovery governance, query-performance monitoring privacy/fail-closed behavior, and API version headers.

### CI/CD — IMP-025

Backend CI now executes:

1. `npm ci`
2. quality/lint gate
3. generated configuration drift verification
4. migration recovery verification
5. TypeScript typecheck
6. unit tests
7. backend build
8. production Docker build
9. PostgreSQL 17 integration tests under a `NOSUPERUSER NOBYPASSRLS` application-like role

A release workflow now validates the same critical gates before publishing a backend image to GitHub Container Registry with release and immutable SHA tags, provenance, and SBOM generation.

### Migration recovery — IMP-027

Migration recovery governance is now reusable and unit-testable rather than being only a script. The verifier enforces:

- exact journal/manifest correspondence
- recognized recovery strategies
- non-empty recovery rationale
- explicit destructive rollback policy
- prohibition of destructive rollback for forward-only security migrations
- a named automated recovery test before any `automated-down` strategy can be accepted

Existing migrations remain restore/compensating/forward-only where appropriate; unsafe synthetic down migrations were not invented.

### Query performance monitoring — IMP-028

The monitor now:

- reads aggregate `pg_stat_statements` metrics only
- never selects or exposes raw SQL/query parameters
- bounds thresholds/result counts
- reports extension absence, insufficient permission, and generic database failures without crashing the application
- emits only aggregate operational startup data

### API versioning — IMP-030

The API continues to use explicit versioned paths through `API_PREFIX` (`/api/v1` by default) and now also advertises:

- `x-api-version: v1` (derived from the configured versioned prefix)
- `x-api-version-policy: path`

The headers are exposed through CORS and covered by an integration regression test.

### Domain repository ownership — IMP-031

`src/domain/contracts/repositories.ts` remains the single definition source for repository interfaces and records. `src/application/contracts/security.ts` no longer owns duplicate repository declarations; its repository exports are explicitly deprecated type-only compatibility re-exports. New code must import domain repository contracts directly.

The compatibility bridge remains intentionally available for the legacy monolithic PostgreSQL repository consumer until that repository is split/refactored. That bridge does not create an application-owned repository contract and therefore does not change the domain ownership decision.

---

## Validation Handoff to VS Code / Copilot

The next activity is validation, not another implementation wave. Run the following from the clean `feat/improvements` checkout and fix any implementation regression before considering the validation labels closed:

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

Then perform the existing HTTP/runtime probes for health, OpenAPI, request validation, RFC7807, correlation IDs, rate limits, recovery enumeration resistance, MFA route protection, API version headers, and PostgreSQL/RLS tenant isolation.

Docker/image publishing, external provider delivery, production key rotation, worker execution, and `pg_stat_statements` must be validated only in environments that actually provide those capabilities.

---

## Architectural Guardrails

- Do not weaken or bypass PostgreSQL RLS for tests, migrations, performance monitoring, or operational workers.
- Do not introduce raw SQL/query-text telemetry through an application endpoint.
- Do not store verification/password-reset secrets in plaintext.
- Do not invent destructive migration rollback SQL merely to claim reversibility.
- Do not add blanket partitioning; IMP-029 remains evidence-driven under ADR-0023.
- Do not encode organization-specific behavior in application code; configuration remains data.
- Do not treat deployment/provider validation as missing source-code implementation.

`IMPROVEMENTS.md` is the authoritative item-by-item status; this file is the backend implementation handoff summary.

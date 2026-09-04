# NEW_ERP_FINAL — Independent Architecture & Security Audit
## Reconciled Audit

### 1. Audit Status

| Item | Value |
|---|---|
| Repository | `Sachin-Salgar/NEW_ERP_FINAL` |
| Branch | `main` |
| Audited commit | `300583c9774b779e9f7b876077e5f54d22c5b1aa` |
| Audit date | 2026-09-04 |
| Working-tree status | Clean before audit; this report is the sole intentional audit artifact |
| Assessment status | **AMBER — Safe to continue controlled development; not yet production-ready.** |

This report reconciles the external independent audit against the current repository. Repository source, tests, migrations, configuration, workflows, Docker configuration, and authoritative architecture documents were inspected. The external report was treated as an input, not as ground truth.

### 2. Executive Summary

#### Reconciled classification counts

| Classification | Count |
|---|---:|
| CONFIRMED | 1 |
| PARTIALLY CONFIRMED | 5 |
| FALSE POSITIVE | 4 |
| ALREADY IMPLEMENTED | 0 |
| NOT VERIFIABLE | 0 |

The counts cover C-01 through C-10. `ALREADY IMPLEMENTED` is zero because the reviewed C-series items were either active concerns, partial concerns, rejected concerns, or deployment-evidence concerns. Existing controls are listed separately below. `ALREADY IMPLEMENTED = 0` applies specifically to the original C-01–C-10 findings; existing platform/security controls already present in the repository are recorded separately in Section 6.

The implementation has strong security and architecture foundations: identity-derived tenant context, PostgreSQL RLS with `FORCE ROW LEVEL SECURITY`, transaction-local context, Unit of Work support, JWT RS256/JWKS, refresh rotation, MFA encryption, single-use recovery tokens, validation, rate limiting, correlation IDs, migration recovery governance, and provider-neutral platform contracts.

The principal current code gap is incomplete security-event audit integration. The principal platform risk is that worker invocation trust and transactional outbox adoption need stronger explicit boundaries and evidence before production-scale asynchronous processing. Deployment-dependent evidence remains separate from repository defects.

### 3. Current Security Architecture Assessment

#### Identity and tenant isolation

- Login uses deployment-independent identifier discovery through [0003-identity-based-login.sql](src/infrastructure/database/migrations/0003-identity-based-login.sql) and [identity-aware-postgres-platform-repository.ts](src/infrastructure/database/repositories/identity-aware-postgres-platform-repository.ts).
- Password verification and tenant-owned reads occur after tenant context is established.
- `requireAuth` derives `request.tenantId` from validated JWT claims and server-side session state in [auth.ts](src/presentation/http/middleware/auth.ts).
- Client headers, URLs, and deployment hostnames are not authoritative tenant sources.
- Tenant tables use PostgreSQL RLS and `FORCE ROW LEVEL SECURITY`; policies compare `tenant_id` with transaction-local `app.current_tenant_id`.
- CI creates application-like `NOSUPERUSER NOBYPASSRLS` PostgreSQL roles in [backend-ci.yml](.github/workflows/backend-ci.yml) and [ci-integration-postgres.yml](.github/workflows/ci-integration-postgres.yml).
- [tenant-rls.test.ts](tests/integration/tenant-rls.test.ts) covers tenant visibility, writes, rollback, and pooled-connection context isolation.

#### Transactions and application boundaries

- [UnitOfWork](src/infrastructure/database/unit-of-work.ts) owns explicit begin, commit, rollback, and transaction-context propagation.
- [withTenantContext](src/infrastructure/database/tenant-context.ts) reuses an ambient transaction client and otherwise provides a bounded repository transaction.
- Tenant switching inside one ambient transaction is rejected.
- Service orchestration such as tenant bootstrap and user registration uses transaction runners.
- This preserves both service-level atomicity and safe repository-level convenience operations.

#### Authentication and credential protection

- JWT validation supports RS256/JWKS through [rotating-jwt-key-ring.ts](src/infrastructure/security/rotating-jwt-key-ring.ts).
- Issuer, algorithm, key identifier, token type, and expiry are validated.
- Legacy HS256 compatibility is explicitly bounded by configuration and issuer validation.
- Refresh tokens are rotated in [refresh-token-rotation-service.ts](src/application/services/refresh-token-rotation-service.ts); the current token is replaced, prior values are recorded, and replay revokes the server-tracked session.
- MFA secrets use AES-256-GCM with random IVs and authentication tags in [aes-secret-protector.ts](src/infrastructure/security/aes-secret-protector.ts). Production rejects the development placeholder through [schema.ts](src/config/schema.ts).
- Password recovery tokens use 32 random bytes, SHA-256 storage hashes, expiry, atomic consumption, and single-use enforcement in [account-security-service.ts](src/application/services/account-security-service.ts) and [postgres-account-security-repository.ts](src/infrastructure/database/repositories/postgres-account-security-repository.ts).

#### API and observability controls

- Zod/JSON-schema request validation, bounded request bodies, authentication rate limits, response error handling, API version headers, and correlation IDs are implemented.
- `/health/live` and readiness/database health behavior are separate.
- The PostgreSQL audit foundation is append-oriented, tenant-scoped, RLS-protected, metadata-allowlisted, and transaction-aware in [postgres-audit-logger.ts](src/infrastructure/audit/postgres-audit-logger.ts).
- Authentication, MFA, recovery, and session-security operations are not yet sufficiently wired to that audit contract.

### 4. Active Findings

Only findings requiring genuine action or external evidence appear here.

| ID | Finding | Severity | Evidence | Impact | Required Action |
|---|---|---|---|---|---|
| C-01 | Worker execution trust boundary and tenant-isolation evidence require strengthening. | P1 | [outbox-dispatcher.ts](src/application/services/outbox-dispatcher.ts), [scheduler-worker.ts](src/application/services/scheduler-worker.ts), [notification-delivery-worker.ts](src/application/services/notification-delivery-worker.ts), [postgres-operational-workers.ts](src/infrastructure/database/repositories/postgres-operational-workers.ts), migration `0010-operational-services.sql` | Worker methods receive a tenant identifier and use tenant-filtered stores. There is no public HTTP worker-selection surface, and worker tables are RLS-protected with `FORCE ROW LEVEL SECURITY`. A compromised or misconfigured worker process with database access could nevertheless invoke a different tenant scope. No public API tenant breakout was demonstrated. | Define the trusted worker invocation boundary, constrain worker execution to trusted infrastructure/database state, and add cross-tenant worker tests using an application-like non-bypass role. |
| C-03 | MFA key lifecycle and operational key management require strengthening. | P2 | [aes-secret-protector.ts](src/infrastructure/security/aes-secret-protector.ts), [schema.ts](src/config/schema.ts), [mfa-service.ts](src/application/services/mfa-service.ts) | AES-256-GCM is cryptographically sound, but the application currently has one configured key and no repository-level rotation procedure. A deployment secret compromise would affect persisted MFA material. | Keep production secret management fail-closed and define a controlled rotation/runbook process appropriate to the deployment environment. |
| C-04 | Pre-authentication identity discovery requires a stronger database privilege/access boundary. | P1 | [0003-identity-based-login.sql](src/infrastructure/database/migrations/0003-identity-based-login.sql), [identity-aware-postgres-platform-repository.ts](src/infrastructure/database/repositories/identity-aware-postgres-platform-repository.ts), [authentication-service.ts](src/application/services/authentication-service.ts) | `auth_login_identifiers` intentionally supports the `login identifier -> tenant discovery -> authentication context` sequence before tenant context exists. Ordinary tenant RLS therefore cannot simply be imposed on this table. The public authentication flow already uses generic responses for account-enumeration resistance; the remaining concern is database-level privilege exposure to this pre-authentication lookup, not tenant-isolation bypass or authorization. | Minimize and separate database privileges for the narrowly required pre-auth lookup, preserve generic authentication responses, and verify deployment role separation. |
| C-08 | `x-tenant-id` creates API authority ambiguity in unauthenticated security flows. | P2 | [app.ts](src/presentation/http/app.ts), [account-security.ts](src/presentation/http/routes/account-security.ts) | The header is allowed by CORS and is used by email-verification and password-reset confirmation flows. Authenticated authorization does not trust it; identity/session/JWT state remains authoritative. The current design creates confusion but no demonstrated tenant breakout or authorization bypass. | Review and narrow or remove header-based context for unauthenticated security flows while preserving identity-derived tenant authority. |
| C-09 | Authentication and account-security events are not sufficiently integrated with the audit foundation. | P1 | [postgres-audit-logger.ts](src/infrastructure/audit/postgres-audit-logger.ts), [auth.ts](src/presentation/http/routes/auth.ts), [account-security.ts](src/presentation/http/routes/account-security.ts), [mfa.ts](src/presentation/http/routes/mfa.ts) | Login, failed authentication, MFA, recovery, refresh-replay, and session-security activity lacks a durable, structured security audit trail. This is a forensic and compliance gap, not evidence that authentication is bypassable. | Wire success/failure, lockout, MFA, recovery, replay, and session-security events through the application audit contract. Never record passwords, tokens, MFA secrets, or sensitive credentials. |
| C-10 | Dependency and image vulnerability scanning can be strengthened. | P2 | [backend-ci.yml](.github/workflows/backend-ci.yml), [backend-release.yml](.github/workflows/backend-release.yml) | CI does not explicitly run dependency or image vulnerability scanners. The release workflow already enables BuildKit SBOM generation and provenance attestations. | Add approved dependency/image scanning without duplicating existing SBOM and provenance generation. |

#### Additional low-priority findings

- **P2 refresh limiting:** refresh is protected by the configured global IP-based authentication rate limit; session-specific limiting is not implemented. The endpoint is not unprotected.
- **P2 migration recovery evidence:** migration governance, advisory locking, and manifest verification exist. Production backup restoration and disaster-recovery execution remain operational evidence.
- **P3 client metadata:** authentication currently records generic user-agent/device values and no IP address, limiting anomaly detection.
- **P3 concurrent-session policy:** no maximum concurrent-session policy was found. This is a product/security-policy option, not a tenant-isolation defect.

### 5. Findings Rejected During Reconciliation

These items are **NOT implementation requirements**.

| Original Finding | Decision | Reason |
|---|---|---|
| `token_family_id` and family-wide token schema | **REJECTED — NOT AN ISSUE IN CURRENT ARCHITECTURE** | The current session stores one current refresh hash; rotation replaces it, historical reuse is detected, and replay revokes that session and its current descendant. |
| Argon2id/bcrypt reset-token hashing | **REJECTED — NOT AN ISSUE IN CURRENT ARCHITECTURE** | Recovery tokens contain 32 random bytes. SHA-256 is appropriate for high-entropy opaque tokens; password-hashing algorithms are not required for this threat model. |
| Mandatory ambient Unit of Work for every repository call | **REJECTED — NOT AN ISSUE IN CURRENT ARCHITECTURE** | Ambient Unit of Work reuse is implemented, while bounded repository transactions are an intentional safe convenience for isolated operations. |
| Ordinary RLS on `auth_login_identifiers` | **REJECTED — NOT AN ISSUE IN CURRENT ARCHITECTURE** | The table is specifically required for pre-authentication tenant discovery. Privilege restriction and generic responses are the compatible controls. |
| `x-tenant-id` authorization bypass | **REJECTED — NOT AN ISSUE IN CURRENT ARCHITECTURE** | Protected middleware uses validated session/JWT tenant state, not this header. The remaining concern is API ambiguity, tracked only as C-08. |
| Mandatory cryptographic worker payload signing | **REJECTED — NOT AN ISSUE IN CURRENT ARCHITECTURE** | The demonstrated gap is the worker trust boundary and its evidence, not a proven need for signed payloads. |
| Absent SBOM, absent provenance, or absent readiness/liveness behavior | **REJECTED — NOT AN ISSUE IN CURRENT ARCHITECTURE** | Release configuration already enables SBOM and provenance; separate liveness/readiness behavior exists. |

### 6. Already Implemented Security Controls

- Identity-based tenant discovery and session-bound tenant context.
- PostgreSQL RLS with `FORCE ROW LEVEL SECURITY` on tenant-owned tables.
- Non-superuser, `NOBYPASSRLS` integration-test roles.
- Transaction-local tenant settings and connection cleanup.
- Unit of Work with AsyncLocalStorage transaction propagation.
- Cross-tenant transaction switching prevention.
- JWT RS256/JWKS support with bounded legacy compatibility.
- Refresh-token rotation, historical reuse detection, and session revocation.
- AES-256-GCM MFA secret protection and production placeholder rejection.
- Atomic, expiring, single-use email and password-recovery tokens.
- Generic recovery responses to reduce account enumeration.
- Password policy and account lockout.
- Request validation, request-size limits, rate limiting, and correlation IDs.
- RFC 7807 opt-in responses with protected internal error details.
- API versioning and generated OpenAPI documentation.
- Append-oriented, tenant-scoped audit storage with metadata allowlisting.
- Migration recovery manifest verification and advisory locking.
- Provider-neutral notification, storage, scheduler, and event contracts.
- Docker healthcheck and release-time SBOM/provenance generation.

### 7. Production Readiness Gaps

#### A. Repository/code gaps

1. Integrate authentication, MFA, recovery, refresh-replay, and session-security audit events.
2. Define the worker invocation trust boundary and add worker cross-tenant isolation tests.
3. For business operations that require durable asynchronous side effects, publish the required outbox record inside the same Unit of Work as the business mutation.
4. Add explicit outbox failure, lease-expiry, duplicate-delivery, and consumer-idempotency tests for workflows that adopt durable asynchronous delivery.
5. Review unauthenticated security-flow use of `x-tenant-id`.
6. Add dependency and image vulnerability scanning if approved by the supply-chain policy.

#### B. Deployment/operational evidence gaps

1. Validate worker/scheduler supervision, scaling, and failure recovery in the target deployment.
2. Validate concrete notification and storage providers.
3. Provision and exercise production JWT and MFA key rotation.
4. Execute backup/restore and disaster-recovery verification.
5. Validate `pg_stat_statements` deployment behavior.
6. Verify CI registry publication, image attestations, and operational observability.
7. Validate process signal handling and graceful shutdown in the deployment environment.

These evidence gaps do not justify inventing credentials, providers, infrastructure, or production claims.

### 8. Required Tests

The smallest high-value tests for genuine gaps are:

1. **Worker isolation:** create jobs/events for two tenants with a `NOSUPERUSER NOBYPASSRLS` role and prove a worker cannot claim or update the other tenant’s records.
2. **Worker invocation:** prove the worker entry point cannot be selected by an untrusted HTTP request and that its tenant scope comes from trusted queue/database state.
3. **Outbox atomicity:** for a business operation that requires a durable asynchronous side effect, run the business mutation and required event append in one Unit of Work; prove either both commit or both roll back.
4. **At-least-once delivery:** for an adopting workflow, simulate a transport success followed by acknowledgement failure and prove redelivery is safe for an idempotent consumer.
5. **Refresh concurrency:** issue concurrent refresh attempts and prove deterministic single-current-token behavior and replay revocation.
6. **Recovery replay:** consume a recovery token twice and prove the second attempt fails.
7. **Audit integrity:** prove authentication/security events are emitted without secrets and cannot be updated or deleted through the application role.
8. **Migration recovery:** execute the supported recovery verification in CI and separately exercise backup restoration in the target operations environment.

### 9. Implementation Roadmap

Only intended, evidence-backed work is listed.

#### P0

No repository-proven P0 vulnerability was demonstrated.

#### P1

1. Add authentication and account-security audit-event integration.
2. Define the worker trust boundary and add worker tenant-isolation tests.
3. Standardize transactional outbox adoption for business operations that require durable asynchronous side effects; do not require an outbox event for unrelated database mutations.
4. Add outbox atomicity, lease, failure, and duplicate-delivery tests for workflows using durable asynchronous delivery.
5. Establish deployment database-role separation for pre-auth identity lookup.
6. Add concurrent refresh/replay tests.

#### P2

1. Review and narrow unauthenticated `x-tenant-id` usage.
2. Define MFA key rotation and operational handling.
3. Add bounded outbox retry/dead-letter policy where required by an adopting workflow.
4. Define consumer idempotency conventions.
5. Add approved dependency and image vulnerability scanning.
6. Validate migration recovery, backup/restore, worker deployment, and external providers.
7. Consider session-specific refresh limiting if threat telemetry justifies it.

#### P3

1. Capture real client metadata for anomaly detection.
2. Define a concurrent-session limit if product policy requires one.
3. Add representative load and horizontal-worker tests.
4. Reassess cache, search, reporting, and other ERP foundations only when actual vertical slices require them.

### 10. ERP Development Readiness

The platform is sufficiently mature for continued controlled ERP vertical-slice development. Authentication, authorization, tenant isolation, RLS, transactions, audit storage, validation, API versioning, operational contracts, and migration governance provide a sound foundation.

Before production-scale asynchronous operation, complete worker trust-boundary evidence, outbox adoption conventions, audit-event wiring, and deployment validation. Business modules should use the existing Unit of Work and event contracts rather than introducing speculative infrastructure.

Approval workflows, document integration, finance, inventory, production, search, cache, and reporting designs should be introduced only when required by an approved vertical slice and supported by concrete requirements.

### 11. Architecture Decisions to Preserve

- Clean Architecture and modular-monolith deployment.
- Platform-first and provider-neutral boundaries.
- Identity-derived tenant context.
- PostgreSQL RLS and `FORCE ROW LEVEL SECURITY` as the final tenant-isolation boundary.
- UUIDv7 identifiers and tenant-aware composite indexes.
- Soft-delete semantics and database integrity constraints.
- JWT RS256/JWKS with bounded, explicitly configured compatibility behavior.
- Current single-current-refresh-token session rotation model.
- Unit of Work and AsyncLocalStorage transaction context.
- Tenant-aware repositories and fail-closed context behavior.
- Pre-auth identity lookup as a narrowly privileged discovery mechanism.
- Append-oriented audit architecture and correlation IDs.
- Configuration validation and production fail-closed secret checks.
- Migration recovery governance and advisory locking.
- For business operations that require durable asynchronous side effects, use a transactional outbox in the same Unit of Work; delivery remains at-least-once with idempotent consumers, and no exactly-once claim is made.

### 12. Final Verdict

**AMBER — Safe to continue controlled development; not yet production-ready.**

1. **Which findings are real?**
   C-09 is confirmed. C-01, C-03, C-04, C-08, and C-10 are genuine but narrower than originally stated. Low-priority metadata, session-policy, refresh-limiting, and operational-evidence gaps also remain.

2. **Which are false positives?**
   C-02, C-05, C-06, and C-07 are false positives as stated. Claims that release SBOM/provenance and readiness/liveness behavior are absent are also rejected.

3. **Which are already implemented?**
   RLS, tenant isolation, transaction propagation, refresh rotation, MFA protection, recovery-token safety, JWT validation, migration recovery governance, API hardening, health behavior, Docker validation, SBOM generation, and provenance generation.

4. **Which recommendations should not be implemented?**
   The rejected proposals in Section 5 are not implementation requirements. Future changes must be driven by demonstrated repository evidence and approved architecture decisions.

5. **What are the actual P0/P1 issues?**
   No P0 issue was demonstrated. P1 work is audit-event integration, worker trust-boundary evidence, transactional outbox adoption/testing, database-role separation, and refresh concurrency testing.

6. **What should be fixed before the next ERP vertical slice?**
   Establish audit-event and outbox conventions, define worker trust boundaries, and add the focused isolation/concurrency tests.

7. **What can safely wait?**
   Key envelope designs, cache/search, approval workflows, session limits, load testing, backup runbooks, and deployment-scale worker validation can wait unless the target rollout requires them.

8. **Is main safe to continue development from?**
   Yes. `main` is a sound controlled-development baseline, with the AMBER production-readiness classification above.

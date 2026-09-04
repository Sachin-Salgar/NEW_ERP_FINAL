# Security Audit — Core Enterprise

**Date:** 2026-09-04
**Scope:** Authentication, authorization, tenant context, PostgreSQL RLS, token handling, CORS/configuration, and fail-closed behavior in the current Core Enterprise implementation.  
**Method:** Repository inspection plus existing unit/integration/CI evidence. This is an implementation/security architecture audit, not a penetration test.

## 1. Authority

The audit follows the current security documentation, approved ADRs, and governance hierarchy. Source code and tests are treated as implementation evidence rather than architectural authority.

## 2. Findings

### Authentication

- Protected HTTP routes use `requireAuth` before authenticated operations.
- Bearer tokens are parsed from the Authorization header and verified cryptographically.
- JWT verification validates the issuer, token type, expiry, algorithm, and key identifier through the configured RS256/JWKS key ring; legacy HS256 compatibility is bounded by explicit configuration.
- Access and refresh token types are distinguished and rejected when used in the wrong context.
- Expired, malformed, invalid, and unexpected token types fail closed with `401`.
- Session validation is performed against the tenant carried by the verified token before the request is accepted.
- Logout/session invalidation is covered by the authentication integration flow.

**Assessment: PASS for inspected implementation.**

### Tenant security

- Tenant authority is derived from authenticated session/JWT state.
- `x-tenant-id` may select pre-authentication lookup context where the endpoint requires it, but it is not an authentication or authorization authority.
- Tenant-owned database work uses transaction-local tenant context and PostgreSQL RLS.
- The architecture does not reintroduce host/domain-based tenant selection.

**Assessment: PASS for inspected implementation.**

### Authorization

- Backend authorization is enforced independently of Flutter visibility.
- Permission middleware checks authentication, active organization context, module enablement, and effective permission.
- Module access is evaluated server-side.
- Self-access exceptions are explicit in `requirePermissionOrSelf` rather than being implied by frontend behavior.

**Assessment: PASS for inspected implementation.**

### PostgreSQL RLS

- RLS is part of the tenant isolation boundary.
- CI runs against a dedicated non-superuser/non-BYPASSRLS PostgreSQL test role.
- Existing integration coverage validates tenant isolation, rollback, and pooled connection context behavior.

**Assessment: PASS for the tested database boundary.**

### Token and secret handling

- JWT signing and verification use the configured key-ring/issuer policy.
- Production configuration rejects development signing-key placeholders and invalid key-ring configuration.
- Authentication responses are tested not to expose password hashes or submitted passwords.
- Refresh/access token values are not persisted as plaintext token material by the token hashing helper.

**Assessment: PASS for inspected implementation.**

### CORS and browser API boundary

- Production CORS is restricted to the configured `CORS_ALLOWED_ORIGINS` allowlist.
- Development/test loopback behavior is intentionally broader to support local Flutter Web execution.
- The production configuration therefore does not inherit the permissive local behavior.

**Assessment: PASS for inspected configuration logic.**

## 3. Existing validation evidence

- Backend authentication integration tests pass in the deterministic Postgres CI environment.
- Backend RBAC integration tests pass in the deterministic Postgres CI environment.
- Admin Flutter Web E2E login/dashboard flow passes in CI.
- Limited-user Flutter Web E2E login/dashboard flow passes in CI.
- Flutter unit/widget test suite and analyzer have passed in the current validation cycle.

## 4. No confirmed critical/high findings

No confirmed critical or high-severity security violation was identified in the inspected Core Enterprise execution paths.

No architectural bypass was identified where frontend-only authorization, host-based tenant selection, or client-supplied tenant identity becomes authoritative.

## 5. Remaining security validation

The following are intentionally **not claimed as complete** by this document:

- External penetration testing.
- Production infrastructure hardening review.
- Provider-specific TLS/security configuration verification.
- Secret rotation exercise in the deployed environment.
- Dependency vulnerability assessment using an external vulnerability database.
- Formal threat-model review for future business modules.

These are operational/security assurance activities beyond the current repository implementation audit.

## 6. Verdict

**STATIC SECURITY AUDIT: PASS — NO CONFIRMED CRITICAL/HIGH FINDINGS.**

The implementation is aligned with the current security architecture for the inspected Core Enterprise paths. Dynamic penetration testing and production operational assurance remain separate activities and must not be represented as completed by this static audit.

## 7. Reconciled Audit Disposition

The following disposition is the permanent record for the independent audit concerns reviewed against the repository implementation. Repository controls and deployment evidence are intentionally distinct.

| Finding | Final disposition | Permanent evidence or requirement |
|---|---|---|
| C-01 worker trust boundary and tenant isolation | **DOCUMENTED — IMPLEMENTED; deployment evidence remains** | Workers require typed persisted-work scope and application-like non-bypass database roles; PostgreSQL isolation and outbox tests cover claim/update boundaries. Deployment must preserve this role and invocation boundary. |
| C-02 stated audit concern | **DOCUMENTED — REJECTED / FALSE POSITIVE** | The reconciled implementation review found no repository defect requiring the proposed change. |
| C-03 MFA key lifecycle | **DOCUMENTED — PARTIAL / REMAINING GAP** | AES-256-GCM, production placeholder rejection, and wrong-key failure are implemented. Controlled production key rotation and operational handling remain deployment evidence. |
| C-04 pre-authentication identity lookup | **DOCUMENTED — PARTIAL / REMAINING GAP** | `auth_login_identifiers` is intentionally used before tenant context exists. Production database-role separation for the narrowly scoped lookup remains deployment evidence; ordinary tenant RLS is not applicable to this sequence. |
| C-05 stated audit concern | **DOCUMENTED — REJECTED / FALSE POSITIVE** | The reconciled implementation review found no repository defect requiring the proposed change. |
| C-06 stated audit concern | **DOCUMENTED — REJECTED / FALSE POSITIVE** | The reconciled implementation review found no repository defect requiring the proposed change. |
| C-07 stated audit concern | **DOCUMENTED — REJECTED / FALSE POSITIVE** | The reconciled implementation review found no repository defect requiring the proposed change. |
| C-08 `x-tenant-id` ambiguity | **DOCUMENTED — IMPLEMENTED; deployment evidence remains** | The header is only a pre-authentication context selector. Authenticated JWT/session tenant state remains authoritative, and missing, malformed, wrong, and override cases are tested. |
| C-09 security-event audit integration | **DOCUMENTED — IMPLEMENTED; deployment evidence remains** | Authentication, MFA, recovery, refresh-replay, and session-security flows use structured, redacted, correlation-aware audit events. Retention and monitoring remain operational concerns. |
| C-10 dependency and image scanning | **DOCUMENTED — IMPLEMENTED; deployment evidence remains** | CI/release workflows run dependency and Trivy image checks and publish SBOM/provenance metadata. Registry and execution evidence remains environment-specific. |

### Rejected recommendations

The following recommendations were explicitly reviewed and are not requirements of the current architecture:

- A `token_family_id` or separate family-wide refresh-token schema. The current single-current-refresh-token session model records prior values, detects replay, and revokes the session.
- Argon2id/bcrypt hashing for high-entropy recovery tokens. Recovery tokens contain 32 random bytes and are stored as SHA-256 hashes with expiry and atomic single-use consumption.
- Ordinary RLS on `auth_login_identifiers`. Pre-authentication discovery must occur before tenant context exists; scoped database privileges and generic responses are the compatible controls.
- Mandatory ambient Unit of Work for every repository call. Ambient reuse is supported while bounded repository transactions remain intentional for isolated operations.
- Signed worker JWT payloads as a mandatory worker design. The required control is the typed persisted-work scope and trusted invocation boundary.
- `x-tenant-id` as an authentication or authorization authority. Authenticated session/JWT tenant state is authoritative.
- Claims that SBOM, provenance, or readiness/liveness behavior are absent. The release and health designs already provide these controls.

### Remaining operational evidence

The repository does not claim deployment proof for worker supervision and recovery, external notification/storage providers, production JWT/MFA key rotation, backup restoration, `pg_stat_statements`, registry attestations, or graceful shutdown behavior. These are deployment/operational evidence requirements, not undocumented source-code improvements.

### Additional reviewed items

- Refresh requests remain protected by the configured authentication rate limit; session-specific refresh limiting is not currently required by the approved architecture.
- Client metadata is intentionally limited to the currently supported generic user-agent/device fields; richer IP/anomaly telemetry is a future evidence- or policy-driven enhancement.
- No maximum concurrent-session policy is currently mandated; adding one requires an explicit product/security decision.
- Migration recovery governance is implemented and tested; production backup restoration and disaster-recovery execution remain deployment evidence.

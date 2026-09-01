# Security Audit — Core Enterprise

**Date:** 2026-09-01  
**Scope:** Authentication, authorization, tenant context, PostgreSQL RLS, token handling, CORS/configuration, and fail-closed behavior in the current Core Enterprise implementation.  
**Method:** Repository inspection plus existing unit/integration/CI evidence. This is an implementation/security architecture audit, not a penetration test.

## 1. Authority

The audit follows the current security documentation, approved ADRs, and governance hierarchy. Source code and tests are treated as implementation evidence rather than architectural authority.

## 2. Findings

### Authentication

- Protected HTTP routes use `requireAuth` before authenticated operations.
- Bearer tokens are parsed from the Authorization header and verified cryptographically.
- JWT verification pins the issuer and `HS256` algorithm.
- Access and refresh token types are distinguished and rejected when used in the wrong context.
- Expired, malformed, invalid, and unexpected token types fail closed with `401`.
- Session validation is performed against the tenant carried by the verified token before the request is accepted.
- Logout/session invalidation is covered by the authentication integration flow.

**Assessment: PASS for inspected implementation.**

### Tenant security

- Tenant authority is derived from authenticated session/JWT state.
- `x-tenant-id` is only a consistency/mismatch guard and is not an independent tenant authority.
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

- JWT signing uses the configured secret and issuer.
- Production configuration rejects the development JWT secret.
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

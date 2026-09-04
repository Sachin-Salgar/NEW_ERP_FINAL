# ADR-0021: JWT Signing-Key Rotation and JWKS

**Date**: 2026-09-04  
**Status**: Proposed  
**Scope**: JWT signing-key lifecycle and public-key distribution

## Context

JWT signing keys must be rotatable without invalidating all tokens immediately or requiring manual client configuration. The ERP also needs a safe way for independently deployed clients/services to obtain current public verification keys.

## Decision

Use asymmetric JWT signing keys with `kid` identifiers and a JWKS publication endpoint.

1. Sign access tokens with an asymmetric algorithm approved by the security baseline; private keys remain only in the authentication service's protected secret/key store.
2. Every signing key has a unique `kid` and explicit lifecycle state: active, verification-only, or retired.
3. The JWKS endpoint publishes active and verification-only public keys, never private material.
4. During rotation, introduce the new key for signing while retaining the previous public key for verification until all tokens signed by it have expired plus a defined safety window.
5. Verification selects the key by `kid`; unknown or retired keys fail closed.
6. Key rotation is operationally controlled and auditable. Emergency compromise rotation may revoke the old key immediately, accepting forced reauthentication.
7. Clients must cache JWKS responses for a bounded period and refresh on an unknown `kid` without creating an unbounded request amplification path.
8. Refresh-token lifecycle remains governed separately by ADR-0009; key rotation must not weaken refresh-token revocation or tenant authorization.

## Rationale

Asymmetric keys separate signing authority from verification and make key publication safe. Overlapping verification keys permit controlled rotation without unnecessary session disruption.

## Alternatives Considered

- **Long-lived symmetric secret** — rejected because every verifier would need the signing secret.
- **Manual key distribution** — rejected because it does not scale across deployments and clients.
- **Immediate key replacement without overlap** — rejected because it causes avoidable authentication failures.

## Consequences

- Requires protected key storage and lifecycle operations.
- Adds JWKS caching and rotation testing.
- Improves compromise containment and operational key hygiene.

## Implementation Notes

Document the approved JWT algorithm and maximum token lifetimes in the security baseline. Never expose private keys through configuration endpoints, logs, diagnostics, or JWKS.

## Related Documents

- ADR-0006 Identity-Based Tenant Context and PostgreSQL RLS
- ADR-0009 Token Strategy — Refresh Token Rotation
- `docs/04-backend/07-authentication-and-authorization.md`

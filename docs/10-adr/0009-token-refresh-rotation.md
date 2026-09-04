# ADR-0009: Token Strategy — Refresh Token Rotation

**Status**: Approved  
**Date**: 2026-08-07  
**Approval Date**: 2026-09-04  
**Approved By**: Project Owner following architecture review  
**Scope**: Refresh-token lifecycle for token-based authentication

## Context

The backend authentication architecture uses short-lived access tokens and longer-lived refresh tokens where refresh tokens are part of the selected authentication flow. Refresh-token rotation can reduce the usefulness of a stolen token and can provide a mechanism for detecting replay.

## Problem Statement

What refresh-token strategy should be adopted to provide strong security while maintaining manageable session behavior and implementation complexity?

## Alternatives Considered

1. **Single-use refresh tokens with rotation** — issue a new refresh token for each successful refresh and invalidate the previous token.
2. **Long-lived refresh tokens without rotation** — simpler, but increases the useful lifetime of a stolen token.
3. **Sliding expiration without rotation** — extends sessions but does not by itself address token replay.
4. **Server-side revocation/session store** — provides centralized invalidation and can complement rotation.

## Decision

Adopt single-use refresh-token rotation for authentication flows that use refresh tokens.

On a successful refresh operation, the previous refresh token is invalidated and a replacement is issued. Refresh tokens shall be bound to a server-tracked session/device context where appropriate, and suspicious reuse shall be detectable.

A server-side mechanism for session/revocation state shall support explicit logout, administrative invalidation, credential/security events, and emergency revocation.

This ADR intentionally leaves concrete TTL values, storage technology, and device-binding mechanics to the approved security configuration and implementation design. Those choices must not weaken rotation, replay detection, revocation, or tenant authorization.

## Replay and Reuse Handling

- A refresh token must not be accepted repeatedly after successful rotation.
- Reuse of an invalidated refresh token should be treated as a security signal.
- The response to suspected token-family compromise must include revocation of the affected token family/session where technically supported.
- Refresh-token material must be stored/transmitted according to the approved authentication security design.

## Consequences

### Positive

- Limits the useful lifetime of a stolen refresh token after legitimate rotation.
- Enables detection of refresh-token replay.
- Supports explicit session revocation.

### Negative

- Requires server-side session/token state.
- Requires careful handling of concurrent refresh requests and token-family state.
- Adds migration and implementation complexity compared with static refresh tokens.

## Implementation Notes

- Define access-token TTL and refresh-token TTL through approved security configuration.
- Define refresh-token storage and hashing requirements.
- Define session/device identifiers and their lifecycle.
- Define concurrent-refresh behavior to avoid accidental session invalidation during legitimate races.
- Define logout and administrative revocation procedures.
- Add automated tests for rotation, replay, expiry, revocation, concurrency, and recovery scenarios.
- Update API documentation and SDK guidance after implementation.

## Related Documents

- [Backend Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)
- [Backend Security](../06-security/01-backend-security.md)
- [ADR Index](./README.md)

## Authority

This ADR is **Approved** and is authoritative within its stated scope. Implementation must remain consistent with the approved security architecture and tenant-isolation requirements.
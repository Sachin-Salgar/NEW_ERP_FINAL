# ADR-0009: Token Strategy — Refresh Token Rotation

Status: Proposed

Date: 2026-08-07

Decision Owner: TODO (Security/Architecture)

## Context

Volume 3 defines a token-based authentication strategy using short-lived access tokens and long-lived refresh tokens (Chapter 8). A robust refresh token rotation strategy is required to mitigate token theft and replay attacks while balancing usability.

## Problem Statement

What refresh token strategy should be adopted to provide strong security while minimizing user friction and implementation complexity?

## Alternatives Considered

1. Single-use refresh tokens with rotation on every use (recommended industry best practice).
2. Long-lived refresh tokens without rotation.
3. Refresh tokens with sliding expiration without rotation.
4. Use of refresh token revocation lists / session store.

## Decision

Adopt single-use refresh tokens with rotation: each time a refresh token is used, issue a new refresh token and revoke the previous one. Pair with device/session identifiers and monitoring of suspicious activity. Implement secure storage and short lifetimes for access tokens. Maintain a server-side revocation mechanism for emergency invalidation.

## Consequences

Pros:
- Reduces risk from stolen refresh tokens.
- Improves security posture with limited token reuse.

Cons:
- Requires server-side token tracking and revocation storage.
- Slightly more complex implementation and migration.

## Implementation Notes / TODOs

- Define token lifetime values (access token TTL, refresh token TTL).
- Implement secure token storage and revocation list (or lightweight session store).
- Define logout and session revocation procedures.
- Update API documentation and SDK guidelines.

Cross References

- docs/04-backend/07-authentication-and-authorization.md
- docs/06-security/01-backend-security.md
- docs/10-adr/README.md

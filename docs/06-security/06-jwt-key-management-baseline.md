# JWT Signing-Key Management Baseline

**Status:** Approved implementation baseline  
**Effective date:** 2026-09-04  
**Related decision:** ADR-0021 — JWT Signing-Key Rotation and JWKS

## Purpose

This document supplies the concrete cryptographic implementation value required by ADR-0021 without changing the broader enterprise-security principles.

## Selected Algorithm

The ERP JWT signing baseline is **RS256 (RSASSA-PKCS1-v1_5 using SHA-256)**.

New production signing keys must be RSA asymmetric key pairs. Private keys are signing material and must remain in protected deployment secret storage. Public keys may be exposed through the ERP JWKS endpoint.

The current HS256 implementation is a legacy compatibility state only. Migration to RS256 must use a controlled transition; existing deployments must not silently replace key material or invalidate active sessions without the documented rollout procedure.

## Key Identity and Lifecycle

Every asymmetric signing key has a stable, unique `kid` and one lifecycle state:

- `active` — the single key used to sign newly issued JWTs;
- `verification-only` — no longer signs new tokens but remains trusted while previously issued tokens can still be valid;
- `retired` — not used for signing or verification and not published in JWKS.

At most one key is active for a deployment at a time. Rotation promotes a new key to `active` and demotes the previous active key to `verification-only` for at least the maximum lifetime of tokens that key may have signed, plus an operational safety margin defined by deployment policy.

## Token Requirements

RS256 JWTs must:

- carry `alg=RS256`;
- carry a non-empty `kid` identifying the signing key;
- preserve the existing issuer, subject, tenant, session, token-type, issued-at, and expiry claims;
- fail closed for unknown, malformed, retired, or algorithm-mismatched keys;
- never accept `alg=none` or algorithm substitution.

## JWKS

The public JWKS representation exposes only non-retired public RSA keys and includes `kid`, `kty`, `use`, `alg`, modulus `n`, and exponent `e`.

Private key material must never appear in JWKS, logs, exceptions, API responses, source control, audit metadata, or generated documentation.

Consumers may cache JWKS for a bounded period. Unknown `kid` may trigger one bounded refresh, after which verification fails closed if the key remains unknown.

## Deployment Configuration

Key material is deployment configuration, not organization-specific application code or tenant data. A deployment must provide the active key and any verification-only public keys through an approved secret/configuration mechanism.

A production deployment must not generate an ephemeral signing key at process startup because that would invalidate tokens across restarts and replicas.

## Transition from HS256

The migration sequence is:

1. deploy RS256-capable verification and JWKS support while the existing HS256 path remains explicitly controlled;
2. configure stable RS256 key material and verify `kid`/JWKS publication;
3. switch issuance to RS256;
4. retain only the explicitly authorized legacy verification window required for already-issued tokens;
5. remove HS256 verification after the compatibility window closes;
6. rotate future RS256 keys using active → verification-only → retired lifecycle rules.

The compatibility window is a migration control, not permission to accept both algorithms indefinitely.

## Security Invariants

- The verifier determines acceptable algorithms from server configuration, never from an untrusted JWT header alone.
- A `kid` selects among already-trusted configured public keys; it is not a file path, URL, database query, or dynamic secret lookup supplied by the client.
- Unknown or retired `kid` fails closed.
- Private keys are never stored in PostgreSQL tenant tables.
- Key rotation cannot weaken tenant/session validation or PostgreSQL RLS controls.
- Refresh-token rotation remains governed separately by ADR-0009.

## Validation Required Before Production Activation

- RS256 sign/verify unit vectors;
- rejection of HS256/`none` algorithm substitution after the legacy window;
- unknown and retired `kid` rejection;
- overlap verification during rotation;
- JWKS contains public values only;
- restart/replica validation using stable configured keys;
- access/refresh/session regression testing.

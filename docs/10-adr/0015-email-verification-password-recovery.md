# ADR-0015: Email Verification and Password Recovery

**Date**: 2026-09-04  
**Status**: Approved  
**Approval Date**: 2026-09-04  
**Approved By**: Project Owner following architecture review  
**Scope**: Local-account email verification and password recovery

## Context

Local ERP accounts need a secure way to prove ownership of an email address and recover access without exposing whether an account exists. Recovery must not rely on storing usable reset credentials in plaintext.

## Decision

Implement email verification and password recovery using short-lived, single-use, opaque tokens.

1. Generate cryptographically random tokens and store only a secure hash of each token.
2. Tokens have explicit purposes, short expirations, and single-use consumption semantics.
3. Verification and recovery endpoints return generic responses that do not reveal whether an email address belongs to an account.
4. Password recovery invalidates existing active sessions/refresh credentials for the affected account as part of the security policy.
5. Password reset must pass the existing password policy and must never log the token or new password.
6. Email delivery is accessed through an application delivery abstraction so the authentication flow does not depend on one provider.
7. Rate limits apply to request, verification, and recovery operations to reduce enumeration and abuse.
8. Verification state is tenant-aware where the identity model requires it; a user identity must not be able to verify or reset another tenant's account.

## Rationale

Opaque hashed tokens limit the impact of database exposure. Generic responses reduce account enumeration. Provider abstraction keeps authentication independent from the notification implementation.

## Alternatives Considered

- **Emailing a permanent password** — rejected as insecure.
- **Storing reset tokens plaintext** — rejected because database compromise would expose active credentials.
- **Magic-link-only authentication** — rejected because it does not replace the ERP's existing password authentication requirement.

## Consequences

- Requires email delivery configuration and reliable expiry/cleanup.
- Recovery becomes safer but adds token lifecycle state and tests.

## Implementation Notes

Use a dedicated token-purpose record or equivalent lifecycle model. Consume tokens atomically to prevent replay. Do not make email delivery success a prerequisite for database transaction commit unless the architecture explicitly requires synchronous delivery.

## Related Documents

- `docs/04-backend/07-authentication-and-authorization.md`
- `docs/04-backend/10-password-policy.md`
- ADR-0017 Notification Service

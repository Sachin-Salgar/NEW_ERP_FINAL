# ADR-0016: Multi-Factor Authentication with TOTP

**Date**: 2026-09-04  
**Status**: Approved  
**Approval Date**: 2026-09-04  
**Approved By**: Project Owner following architecture review  
**Scope**: Time-based one-time-password MFA for ERP user accounts

## Context

Password authentication alone is insufficient for privileged ERP access. The platform needs a standards-based second factor that works without a proprietary mobile application or external identity provider.

## Decision

Implement optional TOTP-based MFA with explicit enrollment, challenge, recovery, and administrative policy controls.

1. Use RFC 6238-compatible TOTP with a standard authenticator-app workflow.
2. Generate a unique secret per enrolled user and encrypt the secret at rest using application-managed key material.
3. Require a successful TOTP challenge before activating enrollment.
4. Store recovery codes only as secure hashes; display them once during generation/regeneration.
5. Never log TOTP secrets, recovery codes, or submitted OTP values.
6. Apply rate limiting and bounded failed-attempt handling to MFA challenges.
7. Support policy levels such as optional and required for selected users/roles without weakening tenant authorization.
8. Recovery/reset of MFA must require an authenticated high-assurance flow or explicitly governed administrator action and must be audited.
9. MFA state is part of authentication state and must not bypass existing tenant, organization, branch, location, or permission checks.

## Rationale

TOTP is widely interoperable, offline-capable, and does not require an external SMS dependency. Encrypting the secret and hashing recovery codes limits exposure if application data is compromised.

## Alternatives Considered

- **SMS OTP** — rejected as the primary MFA mechanism because it introduces delivery dependency and weaker security characteristics.
- **WebAuthn only** — deferred as a future stronger factor; it can be added without invalidating this TOTP decision.
- **External IdP MFA only** — rejected because local authentication must remain independently deployable.

## Consequences

- Adds protected key material and MFA lifecycle state.
- Requires careful enrollment/recovery UX and security testing.
- Provides a practical second factor without requiring a new external service.

## Implementation Notes

Use a clock-skew tolerance narrowly and consistently. Bind enrollment completion to the intended user. Audit enrollment, disablement, recovery, and administrative resets. Consider step-up MFA for especially sensitive operations after the base capability is established.

## Related Documents

- `docs/04-backend/07-authentication-and-authorization.md`
- `docs/04-backend/10-password-policy.md`
- ADR-0014 Audit Logging Foundation

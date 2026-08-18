# Frontend Security

**Document Purpose:** Define frontend security responsibilities and their boundary with backend security enforcement.

## 2.1 Scope

The frontend contributes to secure session handling, safe presentation, secure local-state handling, error handling, and reduction of accidental data exposure.

Frontend security complements, but never replaces, backend security.

## 2.2 Objectives

The frontend security strategy aims to:
- Protect user sessions.
- Minimize sensitive client-side storage.
- Prevent accidental data exposure.
- Provide safe authentication/session UX.
- Reduce client-side attack surface.

## 2.3 Security Principles

The frontend follows:
- Zero Trust.
- Least Privilege.
- Secure by Default.
- Defense in Depth.
- Data Minimization.
- Secure Session Management.

Client-side controls are usability and defense-in-depth measures, not substitutes for server-side enforcement.

## 2.4 Authentication and Session Handling

The frontend shall use the established authentication contract and shall not implement an independent authentication protocol.

The current baseline uses JWT-based access and refresh tokens. Token storage, refresh behavior, rotation, expiration, and revocation shall follow the canonical backend/ADR contract.

Access and refresh tokens shall be stored using secure mechanisms appropriate to the supported platform. Credentials and tokens must not be written to ordinary application logs.

Expired or revoked sessions shall be handled consistently with the backend authentication contract.

## 2.5 Authorization

The frontend may use backend-provided authorization information to control:
- Module visibility.
- Menu visibility.
- Button visibility.
- Report visibility.
- Action availability.

Hidden functionality is never a security boundary. Every protected operation must be independently authorized by the backend.

## 2.6 Sensitive Data

Sensitive information shall not be stored locally unless there is an explicit requirement and an appropriate protection mechanism.

The frontend shall not unnecessarily retain:
- Passwords.
- Authentication secrets.
- Payment credentials.
- Encryption keys.
- Sensitive business data.

Temporary sensitive data should be cleared when no longer required.

## 2.7 Session Timeout

The frontend shall respond to backend/session policy and should provide appropriate user feedback when a session is approaching or has reached expiration.

The exact timeout values are policy/configuration concerns and shall not be invented in frontend code.

## 2.8 Secure Logging

The frontend shall never log:
- Passwords.
- Authentication tokens.
- Secret keys.
- Payment credentials.
- Personal identification numbers.

Diagnostic logging shall also avoid unnecessary confidential business information and personally sensitive data.

## 2.9 Error Messages

Security-related errors shall provide useful user guidance without exposing implementation details, credentials, internal topology, database errors, or security-sensitive information.

## 2.10 Client-Side Validation

Client-side validation may improve user experience, but it is not authoritative.

Business, authorization, security, and domain validation shall always be enforced by the backend.

## 2.11 Summary

Frontend security provides secure client behavior and defense in depth while the backend remains the authoritative boundary for authentication decisions, authorization, validation, tenant isolation, and protected business operations.

## Cross References

- [Backend Authentication & Authorization](../04-backend/07-authentication-and-authorization.md)
- [Backend Security](./01-backend-security.md)
- [Enterprise Security Architecture](./04-enterprise-security-architecture.md)
- [Architecture Decision Records](../10-adr/0009-token-refresh-rotation.md)

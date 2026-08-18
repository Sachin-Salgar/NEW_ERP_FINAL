# Security Architecture

This directory contains the **authoritative security architecture and security standards** for the ERP platform.

## Authority

Security policy, principles, authentication/authorization requirements, data-protection requirements, and security controls defined in this directory are authoritative for all ERP modules and platform services.

Approved ADRs in `docs/10-adr/` supersede this documentation only within the explicit scope of an approved ADR.

Implementation details belong in the backend/platform documentation where applicable; implementation must conform to the security policy defined here.

## Security by Design

Security shall be incorporated into every architectural layer through:
- **Authentication**: User identity verification
- **Authorization**: Permission-based access control
- **Encryption**: Protecting data in transit and at rest
- **Input Validation**: Preventing injection attacks
- **Audit Logging**: Recording all security-relevant events
- **Secure Communication**: TLS encryption for all network traffic

Security shall never be treated as a feature added after implementation; it is an architectural concern.

## Authentication

The current baseline authentication architecture uses JWT-based access and refresh tokens. The detailed implementation contract is defined by the canonical backend authentication document and the enterprise security architecture.

Future authentication capabilities such as MFA, SSO, OIDC/SAML federation, passwordless authentication, and certificate-based authentication are architectural capabilities that require their own approved implementation decisions before being introduced into production behavior.

## Authorization

The security architecture defines centralized, policy-driven authorization. Modules must consume the platform authorization capability and must not create independent authorization models that bypass enterprise policy.

The current baseline includes RBAC and permission-based access control. More advanced policy models (ABAC/PBAC/context-aware authorization) may be supported when explicitly specified and approved.

Authorization must account for applicable organizational scope, module access, permissions, and data-isolation rules.

## Security at Each Layer

**Presentation Layer**:
- HTTPS/TLS enforcement
- CSRF protection where applicable
- Secure token storage
- Input validation/sanitization

**API Layer**:
- Authentication validation
- Authorization enforcement
- Rate limiting
- Request size limits
- Secure error messages

**Business Layer**:
- Business rule enforcement
- Invocation of centralized authorization policy
- Audit event generation
- Data access controls

**Data Layer**:
- Encryption at rest where required
- PostgreSQL Row-Level Security (RLS)
- Referential integrity constraints
- Query/data-access auditing where required

## Multi-Tenant Security

Tenant isolation is mandatory. PostgreSQL RLS is the database-level isolation mechanism defined by `docs/03-database/11-multi-tenancy.md` and its applicable ADRs.

Application authorization and database isolation are complementary controls:

```text
Identity
  ↓
Authentication
  ↓
Authorization / organizational scope
  ↓
Business operation
  ↓
Database transaction context
  ↓
PostgreSQL RLS tenant isolation
```

Passing authorization must never be treated as permission to bypass database isolation.

## Related Documentation

- [Architectural Principles](../00-overview/01-architectural-principles.md#principle-7-security-by-design)
- [System Architecture](../02-architecture/02-system-architecture.md)
- [Database Multi-Tenant Architecture](../03-database/11-multi-tenancy.md)
- [Backend Authentication & Authorization](../04-backend/07-authentication-and-authorization.md)
- [Enterprise Security Architecture](./04-enterprise-security-architecture.md)
- [Security Operations](03-security-operations.md)
- [Architecture Decision Records](../10-adr/README.md)

## Implementation Rule

If a feature request requires a security decision that is not established by current authoritative documentation or an approved ADR, implementation must stop at that decision boundary and request an explicit architectural decision. AI and developers must not invent security behavior.

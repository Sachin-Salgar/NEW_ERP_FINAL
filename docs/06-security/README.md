# Security Architecture

## Purpose

This directory contains the authoritative security architecture and security standards for the Enterprise ERP Platform.

Security is a cross-cutting architectural concern. Backend, frontend, platform services, database, integrations, and operations shall conform to the security principles and controls defined here and in applicable approved ADRs.

## Authority

- Security principles and policy in this directory are authoritative for ERP modules and platform services.
- Approved ADRs in `docs/10-adr/` supersede this documentation only within the explicit scope of the approved decision.
- Implementation details belong in the relevant backend, frontend, database, platform, or DevOps documentation and must conform to the applicable security architecture.
- When a required security behavior is not established by current documentation or an approved ADR, implementation must stop at that decision boundary rather than inventing security behavior.

## Security by Design

Security shall be incorporated throughout the architecture through appropriate controls including:
- Authentication.
- Authorization.
- Encryption.
- Input validation.
- Secure communication.
- Audit logging.
- Monitoring and threat detection.
- Data isolation.
- Secrets protection.

Security shall not be treated as a feature added after implementation.

## Sales quotation security scope

The current Sales quotation slice applies backend RBAC and module enablement,
authenticated tenant authority, active-organization checks, customer
relationship boundaries, audit logging, and PostgreSQL RLS/FORCE RLS. It does
not change the existing Core Enterprise security model. Details are in the
[Sales Quotation Management specification](../08-business-modules/sales/01-sales-quotation.md).

## Current Baseline

The current documented authentication baseline uses JWT-based access and refresh tokens. Token lifecycle and refresh/rotation behavior are governed by the canonical backend authentication documentation and applicable ADRs.

The current authorization baseline uses centralized, policy-driven authorization with RBAC/permission-based access control and applicable organization/tenant/data-isolation rules.

Capabilities such as MFA, SSO, OIDC/SAML federation, passwordless authentication, certificate-based authentication, ABAC, or PBAC require explicit implementation decisions before being treated as implemented platform behavior.

## Authorization and Tenant Isolation

Authorization and database isolation are complementary controls.

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

Passing application authorization must never be treated as permission to bypass database isolation.

## Security at Each Layer

### Frontend

The frontend shall:
- Use secure session/token handling.
- Minimize sensitive local storage.
- Avoid exposing secrets through logs or errors.
- Use backend-provided authorization information for presentation decisions.

Frontend controls never replace backend authorization or validation.

### API / Backend

The backend shall enforce:
- Authentication.
- Authorization.
- Input validation.
- Appropriate rate/request limits.
- Safe error handling.
- Business and security rules.
- Audit/security event generation where required.

### Data Layer

The data architecture shall apply appropriate controls including:
- PostgreSQL Row-Level Security where defined by the tenant-isolation architecture.
- Referential integrity.
- Controlled data access.
- Encryption at rest where required.
- Auditing where required.

### Operations

Security Operations shall provide monitoring, vulnerability management, incident response, access governance, and continuous improvement appropriate to the deployment.

## Documents

- [Backend Security](./01-backend-security.md)
- [Frontend Security](./02-frontend-security.md)
- [Security Operations](./03-security-operations.md)
- [Enterprise Security Architecture](./04-enterprise-security-architecture.md)

## Related Documentation

- [Architectural Principles](../00-overview/01-architectural-principles.md)
- [System Architecture](../02-architecture/02-system-architecture.md)
- [Database Multi-Tenant Architecture](../03-database/11-multi-tenancy.md)
- [Backend Authentication & Authorization](../04-backend/07-authentication-and-authorization.md)
- [Backend Logging & Observability](../04-backend/16-logging-and-observability.md)
- [Architecture Decision Records](../10-adr/README.md)

## Maintenance Rules

- Keep security ownership explicit.
- Do not duplicate security policy in module-specific documentation when a centralized rule already exists.
- Do not retain obsolete migration metadata in active security documents.
- Do not invent security mechanisms, protocols, policy values, compliance frameworks, or operational tooling.
- Resolve ambiguous security decisions through an approved architectural decision before implementation.

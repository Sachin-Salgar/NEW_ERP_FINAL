# Enterprise Security Architecture

**Document Purpose:** Define the canonical enterprise security principles and cross-cutting security architecture for the ERP platform.

## 1. Purpose and Scope

Enterprise Security Architecture establishes the security foundation for protecting ERP users, business data, APIs, infrastructure, integrations, and operational processes.

Security is a cross-cutting platform capability. Business modules consume the established security services and must not create conflicting authentication, authorization, tenant-isolation, audit, or secret-management mechanisms.

## 2. Security Objectives

The architecture aims to:

- protect confidentiality;
- preserve data integrity;
- ensure availability and resilience;
- maintain accountability and traceability;
- support applicable organizational and regulatory requirements;
- minimize operational risk;
- provide auditable security controls.

## 3. Security Principles

The ERP follows:

- Least Privilege.
- Defense in Depth.
- Secure by Default.
- Secure by Design.
- Fail Securely.
- Explicit Verification.
- Separation of Duties.
- Continuous Monitoring.
- Appropriate Zero Trust principles at trust boundaries.

## 4. Security Layers

```text
Users / Systems
      ↓
Identity & Authentication
      ↓
Tenant Membership / Active Tenant
      ↓
Authorization
      ↓
Application / API Security
      ↓
Business Services
      ↓
Tenant-scoped Database Transaction
      ↓
PostgreSQL RLS
      ↓
Infrastructure / Audit / Monitoring
```

Compromise of one layer must not automatically imply unrestricted access to lower layers.

## 5. Trust Boundaries

The architecture explicitly considers boundaries between:

- Internet and ERP services;
- frontend/mobile clients and backend APIs;
- APIs and databases;
- internal services;
- external partner systems;
- administrative interfaces;
- third-party services.

Each applicable boundary requires appropriate authentication, authorization, transport protection, validation, and monitoring.

## 6. Identity and Access Management

IAM establishes and manages digital identities. Supported identity mechanisms may include local credentials, enterprise directories, SSO, federation, and future approved identity providers.

Federated authentication establishes identity; ERP authorization remains authoritative for ERP resources.

Identity lifecycle includes provisioning, verification, activation, role/access assignment, review, suspension, deactivation, and archival where applicable.

## 7. Authentication and Session Management

Authentication establishes user identity. A successful authentication must not by itself grant unrestricted tenant access.

The canonical security sequence is:

```text
Authenticate Identity
  ↓
Load Tenant Memberships
  ↓
One eligible tenant → auto-select
Multiple eligible tenants → explicit selection
  ↓
Validate membership
  ↓
Create tenant-scoped session
```

Session controls include validation, expiration, renewal, forced logout, revocation, and reauthentication for sensitive operations where required.

## 8. Tenant and Organization Isolation

Tenant identity is an authorization and data-isolation concern derived from authenticated identity and validated tenant membership.

Deployment and tenant identity are independent:

```text
Deployment endpoint
  = where the ERP backend is located

Tenant context
  = which organization the authenticated user is authorized to operate in
```

### SaaS

Clients connect to the centrally hosted ERP backend. The backend authenticates the user, loads tenant membership, and establishes the active tenant session.

### On-premises

The customer installation exposes the ERP backend through its configured endpoint. Web and mobile clients are configured to connect to that endpoint through the approved LAN, VPN, or secured HTTPS deployment path. The backend still establishes tenant context from authenticated identity and membership.

### Mobile

Mobile clients communicate only with the ERP backend API. PostgreSQL is never directly exposed to mobile clients.

### Prohibited Tenant Authorities

The following are not authoritative tenant sources:

- request hostname;
- subdomain/custom domain;
- deployment configuration;
- frontend URL/path;
- local storage;
- query parameters;
- arbitrary request headers;
- client-supplied tenant IDs.

The backend must validate any tenant-selection request against the authenticated user's memberships before establishing the active tenant.

## 9. Authorization Framework

The backend is the authoritative security boundary for authorization. Frontend navigation and visibility controls are UX conveniences only.

Authorization may consider:

- authenticated identity;
- active tenant;
- tenant membership;
- organization access;
- roles;
- permissions;
- module enablement;
- location/branch restrictions;
- resource ownership;
- business rules.

Business modules must consume centralized authorization and must not bypass the tenant security boundary.

## 10. TenantContext and Database Security

The backend creates `TenantContext` only from trusted authenticated session state after tenant membership validation.

Every tenant-owned database operation must execute in a tenant-scoped transaction:

```text
Authenticated Session
      ↓
TenantContext
      ↓
BEGIN
      ↓
SET LOCAL app.current_tenant_id
      ↓
Tenant-owned queries/writes
      ↓
COMMIT / ROLLBACK
```

The application must execute:

```sql
SET LOCAL app.current_tenant_id = '<trusted tenant UUID>';
```

inside the same transaction before the first tenant-owned read or write.

The value must come from the server-authoritative `TenantContext`. It must never come from a default, fallback, or arbitrary client value.

## 11. PostgreSQL RLS

PostgreSQL Row Level Security is mandatory for tenant-owned data.

A representative policy is:

```sql
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON customer
USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

RLS is a final database enforcement barrier. Application authorization remains mandatory.

Connection pools must not retain tenant context between requests. `SET LOCAL` is preferred because the setting is scoped to the current transaction.

Background jobs must establish tenant context explicitly from trusted job context.

Privileged database roles that can bypass RLS are administrative exceptions and must not be used as normal application execution paths. PostgreSQL documents that superusers and roles with `BYPASSRLS` bypass RLS, so such roles require strict operational control. citeturn0search0turn0search2

## 12. Security Invariants

1. Authentication establishes identity.
2. Tenant membership establishes eligible tenant access.
3. Active tenant selection is permitted only from validated memberships.
4. A single eligible tenant may be auto-selected.
5. Multiple eligible tenants require explicit selection before tenant-scoped operations.
6. Deployment URL/API endpoint is connectivity configuration, not tenant authorization.
7. `TenantContext` comes from the trusted tenant-scoped session.
8. Missing, invalid, expired, or unauthorized tenant context fails closed.
9. Every tenant-owned DB transaction establishes `SET LOCAL app.current_tenant_id` before tenant-owned access.
10. RLS remains mandatory for tenant-owned tables.
11. Frontend state never constitutes tenant isolation.
12. Mobile and web clients use the same backend security contract.
13. PostgreSQL is never directly exposed to clients.
14. Business modules cannot create independent tenant-resolution mechanisms.

## 13. Secrets, Cryptography, and Certificates

Secrets and cryptographic material must not be embedded in source code. Protected deployment configuration must provide database credentials, API secrets, certificate keys, encryption keys, and integration credentials as appropriate.

Sensitive data must be protected in transit and at rest according to classification and deployment requirements.

## 14. Audit, Compliance, and Governance

Security-sensitive events should be auditable, including:

- authentication success/failure;
- tenant selection/switch;
- authorization failures;
- role/permission changes;
- session revocation;
- configuration changes;
- administrative actions;
- data-access violations.

Audit records should include timestamp, identity, tenant context, action, target/resource, source, and correlation information where applicable.

## 15. Security Monitoring and Incident Management

Monitoring may cover applications, authentication, authorization, APIs, databases, infrastructure, network services, and integrations.

Incident response follows an organizationally defined lifecycle such as:

```text
Detection → Analysis → Containment → Eradication → Recovery → Review
```

## 16. Privacy and Data Protection

Privacy principles include Privacy by Design, Privacy by Default, Data Minimization, Purpose Limitation, Accuracy, Storage Limitation, Accountability, and Transparency.

Retention, residency, consent, deletion, and regulatory requirements remain deployment- and organization-dependent unless separately adopted as architectural requirements.

## 17. Security Across ERP Modules

Every business module must consume the established security architecture.

A module must not independently create:

- conflicting authentication;
- a parallel authorization model that bypasses platform controls;
- an independent tenant-isolation mechanism;
- uncontrolled secret storage;
- unaudited security-sensitive operations.

Module-specific authorization rules may exist, but they execute within the established authenticated tenant and backend security boundary.

## 18. Architecture Summary

The canonical ERP security chain is:

```text
Identity
  ↓
Authentication
  ↓
Tenant Membership
  ↓
Active Tenant
  ↓
Tenant-scoped Session
  ↓
Authorization
  ↓
TenantContext
  ↓
Tenant Transaction
  ↓
PostgreSQL RLS
  ↓
Business Operation
```

Deployment location determines how clients reach the backend. It does not determine tenant authorization.

## Cross References

- [Backend Security](./01-backend-security.md)
- [Frontend Security](./02-frontend-security.md)
- [Security Operations](./03-security-operations.md)
- [Backend Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)
- [Multi-Tenant Architecture](../03-database/11-multi-tenancy.md)
- [ADR-0006: Identity-Based Tenant Context and PostgreSQL RLS](../10-adr/0006-identity-based-tenant-context.md)

## Maintenance Rules

- This document is the canonical home for enterprise security policy and cross-cutting security principles.
- Implementation details belong in the appropriate backend, platform, infrastructure, or deployment documentation.
- Do not invent security values, compliance obligations, authentication mechanisms, vendors, or infrastructure products here.
- When an implementation-specific security decision changes, reconcile this document and the applicable implementation architecture.

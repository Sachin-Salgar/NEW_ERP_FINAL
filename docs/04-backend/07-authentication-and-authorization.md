# Authentication & Authorization Flow

**Document Purpose:** Define backend authentication, tenant-context, authorization, and session implementation patterns for the Enterprise ERP Platform.

---

## 7.1 Introduction

Protecting business information is a fundamental responsibility of the ERP backend. Every protected request must establish:

1. Who is making the request? (Authentication)
2. Which tenant may the user operate in? (Tenant membership and active tenant)
3. What are they allowed to do? (Authorization)

Authentication, tenant membership, tenant context, and authorization are distinct responsibilities but form one server-authoritative security lifecycle.

## 7.2 Objectives

The authentication framework aims to:

- Verify user identity.
- Protect business data.
- Support secure sessions.
- Enable multi-device access.
- Support users belonging to one or multiple tenants.
- Prevent unauthorized tenant and business operations.
- Support enterprise-grade security.

## 7.3 Authentication Overview

The ERP shall support, where implemented:

- Username & Password.
- Email & Password.
- Multi-Factor Authentication (future).
- Single Sign-On (future).
- OAuth Integrations (future).

Successful authentication establishes a trusted user identity. Tenant access is then determined from active tenant memberships.

## 7.4 Token Strategy

The backend adopts:

- Short-lived Access Tokens.
- Long-lived Refresh Tokens.

The exact lifetime and rotation policy is governed by the token/session implementation and approved security decisions.

## 7.5 Canonical Authentication and Tenant Flow

The canonical lifecycle is:

```text
Client connects to configured ERP backend endpoint
  ↓
Login
  ↓
Credential Validation
  ↓
Authenticated Identity
  ↓
ERP User
  ↓
Load active Tenant Memberships
  ↓
One tenant → auto-select
Multiple tenants → require tenant selection
  ↓
Validate membership
  ↓
Create tenant-scoped session
  ↓
TenantContext
  ↓
Authorization
  ↓
Tenant-scoped transaction
  ↓
SET LOCAL app.current_tenant_id
  ↓
PostgreSQL RLS
  ↓
Business operation
```

The backend is authoritative throughout this lifecycle. A deployment URL identifies where the backend is located; it does not identify the tenant.

## 7.5.1 Authentication vs Tenant Access

Authentication answers: **Who is this user?**

Tenant membership answers: **Which tenants may this user access?**

Active tenant selection answers: **Which authorized tenant is the user operating in now?**

Authorization answers: **What may the user do within that tenant and its organizations/locations?**

A user with exactly one active tenant membership may have that tenant selected automatically. A user with multiple active memberships must select an authorized tenant. The backend must validate the membership before creating the tenant-scoped session.

## 7.5.2 Canonical Identity, Tenant, Organization, and Location Model

| Concern | Definition | Authoritative source |
|---|---|---|
| Identity | Verified caller identity | Authentication service |
| User | ERP application user associated with identity | User domain |
| Tenant Membership | Relationship granting access to a tenant | Membership domain |
| Tenant | Primary security/data-isolation boundary | Tenant/security domain |
| Organization | Business/legal unit inside tenant | Organization domain |
| Location / Branch / Plant | Operational unit inside organization | Location domain |
| Role | Authorization assignment | Authorization domain |
| Permission | Allowed capability | Authorization domain |
| Active Tenant | Tenant selected from validated memberships for the session | Session/security context |
| TenantContext | Trusted backend context used for tenant-scoped work | Security/database layer |

The backend is authoritative for all of these concepts. Frontend state may display them but cannot create or override them.

## 7.5.3 Tenant Membership and Selection

The tenant access model is membership-based:

```text
User
  ↓
Tenant Memberships
  ↓
Eligible Tenants
```

The backend must load active memberships after successful identity authentication.

If there is no active membership, tenant-scoped access is denied.

If there is one active membership, the backend may auto-select it.

If there are multiple active memberships, the backend must provide the eligible choices and require an explicit selection before tenant-scoped business operations. Tenant selection must perform a server-side membership check.

A user must never gain tenant access by supplying an arbitrary tenant identifier in a request, URL, local storage value, or header.

## 7.5.4 Deployment Endpoint vs Tenant Identity

Deployment and tenancy are independent.

- **SaaS**: clients connect to the centrally hosted backend. Tenant context is derived from authenticated identity and membership.
- **On-premises**: the installation exposes the ERP backend through its configured endpoint. Web and mobile clients are configured with that endpoint. Tenant context is still derived from authenticated identity and membership.
- **Mobile**: the app connects only to the ERP backend and never directly to PostgreSQL.

No host/domain resolver or deployment-specific tenant binding is part of the canonical tenant-security lifecycle.

## 7.5.5 Session and Tenant Context

A tenant-scoped session must contain or reference sufficient trusted state to establish the active tenant for the authenticated user.

The backend must validate:

- session validity;
- user status;
- tenant status;
- tenant membership status;
- applicable organization/location access;
- roles and permissions.

`TenantContext` is created from the trusted authenticated session context. Client-provided tenant identifiers are hints at most and must never override the session's authoritative tenant.

Changing tenants requires a server-side membership check and creation or renewal of the tenant-scoped session/context.

## 7.6 Authorization (RBAC)

After authentication and active tenant establishment, every protected request undergoes authorization.

The ERP implements Role-Based Access Control (RBAC), with additional organization, location, module, and business constraints where applicable.

Illustrative hierarchy:

```text
Tenant
  ↓
Organization
  ↓
Role
  ↓
Permission
  ↓
User
```

Permissions determine which operations a user may perform.

## 7.7 Permission Evaluation

Before executing a business operation, the backend verifies applicable:

- Tenant membership.
- Membership status.
- Organization membership/access.
- Assigned role.
- Module access.
- Permission.
- Branch/location restrictions.
- Business authorization rules.

Access is denied if a required condition fails.

## 7.8 Module-Level Security

Users shall only access modules that are both enabled/licensed for their tenant/organization and authorized for the user.

Module activation and user authorization are separate controls.

## 7.8.1 Tenant and Organization Context

Business modules must consume the platform-provided active tenant and authorization context. They must not discover tenant scope independently.

The canonical sequence is:

```text
Authenticated Identity
  → load eligible tenant memberships
  → select active tenant
  → validate tenant membership
  → resolve organization access
  → resolve location access if relevant
  → produce TenantContext
  → authorize operation
  → begin tenant-scoped transaction
```

Tenant isolation is enforced independently by PostgreSQL RLS.

## 7.9 Audit Requirements

Security-related events shall be audited, including where applicable:

- Successful Login.
- Failed Login.
- Tenant Selection/Switch.
- Password Change.
- Permission Update.
- Session Revocation.
- Token Refresh.
- Authorization Failure.

## 7.10 Session Management

The backend shall support:

- Secure Logout.
- Token Revocation.
- Session Expiration.
- Concurrent Session Management.
- Tenant-scoped session switching.
- Device Tracking (future).

Inactive or invalid sessions shall expire or be rejected automatically.

## 7.11 Database Tenant Context

Tenant-owned database operations must execute inside an explicit tenant-scoped transaction.

Immediately after transaction start and before tenant-owned access:

```sql
SET LOCAL app.current_tenant_id = '<trusted tenant UUID>';
```

The value must originate from `TenantContext` and therefore from authenticated identity plus validated tenant membership/session state.

PostgreSQL RLS remains mandatory as the database isolation boundary.

## 7.12 Summary

The ERP security lifecycle is:

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
Tenant-scoped Transaction + RLS
  ↓
Business Operation
```

Deployment location is a connectivity concern, not a tenant-authorization mechanism.

---

## Cross References

- `docs/03-database/11-multi-tenancy.md`
- `docs/06-security/04-enterprise-security-architecture.md`
- `docs/04-backend/06-api-design-standards.md`

# Authentication & Authorization Flow

**Document Purpose:** Define backend authentication, tenant-context, authorization, and session implementation patterns for the Enterprise ERP Platform.

## 7.1 Introduction

Every protected request must establish:

1. Who is making the request? (Authentication)
2. Which tenant does the authenticated ERP user account belong to? (Tenant identity)
3. What may the user do inside that tenant? (Authorization)

## 7.2 Authentication Overview

The ERP may support local credentials, MFA, SSO, federation, and other approved identity providers. Successful authentication establishes a tenant-scoped ERP user account.

## 7.3 Token Strategy

The backend uses short-lived access tokens and long-lived refresh tokens according to the approved session implementation.

## 7.4 Canonical Authentication and Tenant Flow

```text
Client connects to configured ERP backend endpoint
  ↓
Login identifier + password
  ↓
Deployment-independent login lookup
  ↓
Candidate user_id + tenant_id
  ↓
Tenant-scoped users lookup
  ↓
Password verification
  ↓
Exactly one active credential match
  ↓
Tenant-scoped Session
  ↓
TenantContext
  ↓
Authorization
  ↓
Tenant-scoped transaction + RLS
  ↓
Business operation
```

The backend is authoritative throughout this lifecycle. The deployment URL identifies where the backend is located; it does not identify the tenant.

## 7.5 Identity and Tenant Model

The current ERP user account is tenant-scoped:

```text
users.tenant_id → tenants.id
```

A deployment-independent `auth_login_identifiers` lookup maps login identifiers to candidate tenant user accounts. It contains no password and grants no authorization.

The authoritative password hash remains on the tenant-scoped `users` row. The backend reads that row only after it has a candidate tenant and establishes tenant-scoped database context.

If exactly one candidate verifies successfully, that user's tenant becomes the active tenant for the session.

If multiple active candidate accounts verify successfully, authentication fails closed rather than guessing the tenant.

A separate global identity/membership system is not part of the current architecture. Adding one requires a new approved architectural decision.

## 7.6 Deployment Endpoint vs Tenant Identity

Deployment and tenancy are independent.

- **SaaS:** the client connects to the centrally hosted backend; login discovers the user's tenant from the authenticated account.
- **On-premises:** the client connects to the customer installation's backend endpoint; login discovers the user's tenant from the authenticated account.
- **Mobile:** the app connects only to the ERP backend API and never to PostgreSQL.

No host/domain resolver or deployment-specific tenant binding is part of the canonical authentication lifecycle.

## 7.7 Session and TenantContext

The tenant-scoped session is the trusted application-level source for tenant context after successful authentication.

The backend derives `TenantContext` from authenticated session state. Client-supplied tenant IDs, headers, URLs, query parameters, and local storage values are never authoritative.

The session contains or references at minimum:

- user identity;
- tenant identity;
- session identity;
- organization/location context where applicable;
- authorization information required by the application.

## 7.8 Organization and Location Authorization

Organization, branch, and location are authorization dimensions inside the active tenant.

```text
Tenant
  ↓
Organization Access
  ↓
Location / Branch Access
  ↓
Role
  ↓
Permission
```

Selecting an organization or location must never change the tenant established by the authenticated session.

## 7.9 Authorization (RBAC)

The backend is the authoritative authorization boundary. Frontend navigation and visibility controls are UX conveniences only.

Authorization may consider:

- active tenant;
- organization access;
- role;
- permission;
- module enablement;
- location/branch restrictions;
- resource ownership;
- business rules.

## 7.10 Module-Level Security

Users may access a module only when the module is enabled for the active tenant/organization and the user is authorized for the operation.

## 7.11 Database Tenant Context

Tenant-owned database operations must execute inside an explicit tenant-scoped transaction.

Immediately after transaction start and before tenant-owned access:

```sql
SET LOCAL app.current_tenant_id = '<trusted tenant UUID>';
```

The value must originate from `TenantContext`, which originates from the authenticated tenant-scoped session.

PostgreSQL RLS remains mandatory as the database isolation boundary.

## 7.12 Audit Requirements

Security-sensitive events should be audited, including successful/failed authentication, session creation/revocation, organization/location selection, authorization failures, and security administration changes.

## 7.13 Summary

```text
Configured Backend Endpoint
  ↓
Authentication
  ↓
Identity Lookup → Tenant User Account
  ↓
Tenant-scoped Session
  ↓
TenantContext
  ↓
Authorization
  ↓
Tenant Transaction + RLS
  ↓
Business Operation
```

Deployment location is a connectivity concern, not a tenant-authorization mechanism.

## Cross References

- `docs/03-database/11-multi-tenancy.md`
- `docs/06-security/04-enterprise-security-architecture.md`
- `docs/10-adr/0006-identity-based-tenant-context.md`

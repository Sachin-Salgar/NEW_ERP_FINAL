# Authentication & Authorization Flow

**Document Purpose:** Define backend authentication, tenant-context, authorization, and session implementation patterns for the Enterprise ERP Platform.

## 7.1 Introduction

Every protected request must establish:

1. Who is making the request? (Authentication)
2. Which tenant does the authenticated ERP user account belong to? (Tenant identity)
3. What may the user do inside that tenant? (Authorization)

## 7.2 Authentication Overview

The current application authenticates an identity and establishes one tenant-scoped
ERP user account. Platform administration uses a distinct platform authentication
and authorization context.

## 7.3 Token Strategy

The backend uses short-lived access tokens and long-lived refresh tokens according to the approved session implementation.

## 7.4 Canonical Authentication and Tenant Flow

```text
Client connects to configured ERP backend endpoint
  ↓
Login identifier + password
  ↓
Identity and tenant-membership lookup
  ↓
Single tenant user account
  ↓
Password verification
  ↓
Credential verification
  ↓
Automatic single-tenant establishment
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

A deployment-independent `auth_login_identifiers` lookup maps a login identifier to
the user's single tenant account. It contains no password and grants no authorization.

The authoritative password hash remains on the tenant-scoped `users` row. The backend reads that row only after it has a candidate tenant and establishes tenant-scoped database context.

After credential verification, that user's tenant becomes the active tenant for the
session. The client does not select a tenant, and tenant switching is not supported.

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
- branch context where applicable;
- authorization information required by the application.

## 7.8 Branch Authorization

Branch is a business subdivision inside the active tenant. It is an authorization or
data dimension only when the domain operation requires branch-level distinction.

```text
Tenant
  ↓
Branch Access (where required)
  ↓
Role
  ↓
Permission
```

Branch access must never change the tenant established by the authenticated session.

## 7.9 Authorization (RBAC)

The backend is the authoritative authorization boundary. Frontend navigation and visibility controls are UX conveniences only.

Authorization may consider:

- active tenant;
- role;
- permission;
- module enablement;
- branch restrictions;
- resource ownership;
- business rules.

## 7.10 Module-Level Security

Users may access a module only when the module is enabled for the active tenant and
the user is authorized for the operation.

## 7.11 Database Tenant Context

Tenant-owned database operations must execute inside an explicit tenant-scoped transaction.

Immediately after transaction start and before tenant-owned access:

```sql
SET LOCAL app.current_tenant_id = '<trusted tenant UUID>';
```

The value must originate from `TenantContext`, which originates from the authenticated tenant-scoped session.

PostgreSQL RLS remains mandatory as the database isolation boundary.

## 7.12 Audit Requirements

Security-sensitive events should be audited, including successful/failed authentication,
session creation/revocation, branch access decisions, authorization failures, and
security administration changes.

## 7.13 Summary

### Granular security administration

The active permission catalog is backend-owned and exposes lifecycle actions for
branches and roles, plus role-permission grant/revoke, tenant-scoped session
revocation, persisted tenant security policy read/update, and append-only audit-log read/export.
Lifecycle deletion is a guarded soft-delete operation; system roles and records with protected
dependents cannot be deleted. Tenant administration routes use explicit platform-scope permission
checks and operate only on the authenticated tenant context. The Flutter role matrix renders
module/resource/action cells from the catalog and persists canonical permission keys.

The canonical security-administration keys are `security.session.read`,
`security.session.revoke`, `security.session.revoke_all`, `security.audit_log.read`,
`security.audit_log.export`, `security.policy.read`, and `security.policy.update`.
Branch-specific permission keys are defined only where a domain requires branch-level
authorization; shorter aliases such as `session.read` or `audit.read` are not
registered. Tenant lifecycle uses the existing
`tenant_status_enum`: suspend moves an eligible tenant to `suspended`, reactivate returns
it to `active`, deactivate soft-deletes it as `cancelled`, and activate restores a
cancelled tenant. Invalid transitions are rejected and deletion is blocked when tenant
records or audit history remain.

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
- `docs/10-adr/0040-platform-identity-membership-and-context.md`

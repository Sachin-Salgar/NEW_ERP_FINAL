# ADR-0040: Platform, Tenant, and Branch Architecture

**Date**: 2026-09-06  
**Status**: Approved  
**Approval Date**: 2026-09-06  
**Approved By**: Project Owner
**Scope**: Platform administration, tenant identity, application authentication, tenant isolation, branch access, sessions, JWT context, audit, RLS, and deployment

## Decision

The ERP has one system-level Platform boundary and multiple independent Tenant boundaries.
Each tenant contains business Branches. Branches are business subdivisions inside a
tenant; they are not tenants and do not create an independent security or RLS boundary.

```text
Platform
  └── Tenant
       ├── Branch
       │    ├── Users
       │    ├── Roles
       │    └── Data
       └── Branch
            ├── Users
            ├── Roles
            └── Data
```

Platform administration is separate from normal tenant application access. Platform
permissions and platform sessions are distinct from tenant permissions and tenant
sessions.

An application user belongs to exactly one tenant in the current architecture. A
normal application login establishes that tenant automatically from the authenticated
identity and tenant membership. Tenant selection is not a login step, tenant switching
is not supported, and no multi-tenant application-user context-selection workflow is
part of the architecture.

The authenticated tenant is the only tenant authorization context for a normal
application session. A client-supplied tenant identifier, deployment hostname,
frontend URL, query parameter, header, or local-storage value is never authoritative.

## Normative rules

1. Platform is the system-level administrative boundary.
2. Tenant is the security, authorization, and data-isolation boundary.
3. Every tenant-owned record belongs to exactly one tenant.
4. Branch is the only business subdivision defined below Tenant in this architecture.
5. Branch-specific data uses a domain relationship such as `branch_id` only where the
   business domain requires it.
6. Branch does not establish a separate tenant, database, RLS, or authorization
   boundary.
7. A normal application user has one tenant context and cannot switch tenants.
8. Normal application authentication establishes the user's tenant automatically.
9. Platform administration requires a distinct platform-authenticated session and
   platform authorization.
10. PostgreSQL RLS remains the final enforcement boundary for tenant-owned data.
11. Backend authorization remains authoritative; frontend state never grants access.
12. Web and mobile clients connect to the configured ERP backend and never directly
    to PostgreSQL.

## Authentication and session contract

The normal application flow is:

```text
Login identifier + password
  ↓
Identity and tenant-membership lookup
  ↓
Credential verification
  ↓
Automatic establishment of the user's single tenant
  ↓
Tenant-scoped session and JWT
  ↓
Tenant authorization
  ↓
Tenant transaction with PostgreSQL RLS
```

The platform flow is separate:

```text
Platform administrator credentials
  ↓
Platform membership verification
  ↓
Platform-scoped session and JWT
  ↓
Platform authorization
  ↓
Approved platform administration operation
```

Tenant and platform roles are separate permission domains. A tenant session cannot be
used as a platform session, and a platform session does not grant normal tenant
application access without an explicitly authorized tenant operation.

Sessions and JWTs carry the server-established context. `tenantId` is derived from
validated server state and is not accepted as a client-selected authorization input.
Session revocation and credential security-version checks remain server-authoritative.

## Tenant isolation

Tenant-owned operations run inside an explicit tenant-scoped transaction:

```sql
BEGIN;
SET LOCAL app.current_tenant_id = '<trusted tenant UUID>';
-- tenant-owned queries and writes
COMMIT;
```

The trusted tenant UUID comes from the authenticated tenant session. PostgreSQL RLS
policies enforce that tenant-owned reads and writes match the transaction-local
tenant context. Pooled connections must not retain tenant context between requests.

## Platform administration

Platform administration uses dedicated platform authorization and the approved
operator/bootstrap procedures. Platform operations that create, update, suspend,
reactivate, or otherwise administer tenants are not tenant permissions and are not
exposed as normal tenant operations.

Platform audit records are distinct from tenant audit records. Tenant users cannot
read or write platform audit records through tenant authorization.

## Consequences

- Normal login is deterministic and establishes one tenant without a tenant selector.
- Tenant isolation remains explicit at the application and database layers.
- Branch-level business distinctions are supported without creating another security
  boundary.
- Platform administration remains isolated from normal tenant application access.
- Implementations must not introduce Organisation, Location, tenant switching, or
  multi-tenant application-user context selection as current architecture.

## Related documents

- [Multi-Tenant Architecture](../03-database/11-multi-tenancy.md)
- [Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)
- [Enterprise Security Architecture](../06-security/04-enterprise-security-architecture.md)
- [Document Control and Governance](../00-overview/02-governance.md)

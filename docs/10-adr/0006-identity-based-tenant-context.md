# ADR-0006: Identity-Based Tenant Context and PostgreSQL RLS

**Date**: 2026-08-27  
**Status**: Approved  
**Approval Date**: 2026-08-27  
**Approved By**: Project Owner  
**Scope**: Authentication, tenant context, tenant isolation, web/mobile clients, SaaS and on-premises deployments

## Context

The Enterprise ERP Platform must operate consistently across SaaS, on-premises installations, web clients, and mobile clients.

The ERP deployment endpoint answers one question: **where is the ERP backend?** It may be a cloud API endpoint or a customer-controlled on-premises endpoint. It must not determine which tenant an authenticated user is authorized to operate in.

The existing ERP data model treats `users.tenant_id` as the tenant boundary. The simplified tenancy model keeps the user account tenant-scoped and adds a deployment-independent login lookup index so the backend can discover the user's tenant account before establishing tenant-scoped RLS context.

A login identifier may map to one or more tenant user accounts. The backend verifies credentials against the candidate tenant accounts. Exactly one active credential match establishes the tenant. Ambiguous multiple matches fail closed rather than guessing a tenant. A future global identity/membership model would require a separate approved architectural decision.

The database must continue to provide defense-in-depth tenant isolation through PostgreSQL Row Level Security (RLS).

## Decision

The ERP will use **identity-based tenant context** as the canonical tenancy model.

The authoritative lifecycle is:

```text
Client connects to configured ERP backend endpoint
    ↓
Login identifier + password
    ↓
Deployment-independent login lookup
    ↓
Candidate tenant user account(s)
    ↓
Tenant-scoped user lookup + password verification
    ↓
Exactly one active match
    ↓
Tenant-scoped session
    ↓
TenantContext
    ↓
Authorization
    ↓
Tenant-scoped DB transaction
    ↓
SET LOCAL app.current_tenant_id
    ↓
PostgreSQL RLS
    ↓
Business operation
```

Tenant context MUST NOT be derived from the request hostname, frontend URL, installation URL, deployment tenant mapping, client-supplied tenant identifier, or deployment-specific configuration.

The deployment API endpoint is connectivity configuration only.

## Login Lookup Boundary

Because the tenant is unknown before authentication, the backend uses a small deployment-independent login lookup table to map login identifiers to candidate tenant user accounts.

The lookup table contains no password and does not grant authorization. It only provides candidate `user_id` and `tenant_id` values. Password verification and the authoritative user read occur through the tenant-scoped user repository after the candidate tenant is known.

The application must not expose the login lookup table directly to clients.

## Tenant Account Model

A user account is tenant-scoped:

```text
users
  └── tenant_id → tenants.id
```

The login lookup provides:

```text
login identifier
      ↓
auth_login_identifiers
      ↓
user_id + tenant_id
      ↓
users row
```

The current architecture does not require a separate `tenant_memberships` table for normal ERP login. A future requirement for one global identity with explicit membership across many tenants would require a separate approved architecture decision rather than silently adding another tenancy model.

## Deployment Independence

### SaaS

Web and mobile clients connect to the centrally hosted ERP backend. Authentication discovers the tenant from the authenticated user's tenant-scoped account.

### On-premises

The customer installation provides the ERP backend endpoint. Web and mobile clients are configured to connect to that endpoint directly, through the company LAN, through an approved VPN, or through a secured public HTTPS endpoint as permitted by deployment policy. Authentication and tenant context are identical to SaaS.

### Mobile

Mobile clients never connect directly to PostgreSQL. They communicate only with the ERP backend API. The backend establishes and enforces tenant context.

## Session and Tenant Context

The tenant-scoped session is the trusted application-level source for the active tenant after successful authentication.

The effective request context contains at minimum:

- authenticated user identity;
- tenant identity;
- authenticated session identity;
- authorization information required by the application.

`TenantContext` is created only from this trusted authenticated session state.

A client cannot change tenant context by modifying a request header, URL, query parameter, local storage value, or body field.

## Organization and Location Context

Organization, branch, and location remain authorization dimensions inside the active tenant.

```text
Authenticated User
  ↓
Active Tenant
  ↓
Organization Access
  ↓
Location / Branch Access
  ↓
Business Authorization
```

Organization or location selection must never change the tenant established by the authenticated session.

## PostgreSQL RLS

PostgreSQL RLS remains mandatory for tenant-owned data.

Every tenant-scoped database operation must execute inside an explicit tenant-scoped transaction. Immediately after the transaction begins and before the first tenant-owned query or write, the application must execute:

```sql
SET LOCAL app.current_tenant_id = '<trusted tenant UUID>';
```

The tenant UUID must originate from the server-authoritative `TenantContext` established from the authenticated tenant-scoped session.

## Mandatory Invariants

- Authentication establishes the user account and its tenant.
- The deployment endpoint never establishes tenant identity.
- Login lookup is deployment-independent.
- Password verification is performed against the candidate tenant user account.
- Exactly one active credential match is required to establish a tenant session.
- Ambiguous multiple matches fail closed.
- A tenant-scoped session is required for tenant-scoped business operations.
- `TenantContext` is derived only from trusted authenticated session state.
- Client-supplied tenant identifiers are never authoritative.
- Every tenant-owned database transaction establishes `SET LOCAL app.current_tenant_id` before tenant-owned access.
- RLS is mandatory for tenant-owned tables.
- Missing, invalid, expired, or unauthorized tenant context fails closed.
- Mobile and web clients use the same backend tenancy contract.
- PostgreSQL is never directly exposed to clients.
- Business modules must consume the platform TenantContext and must not implement their own tenant discovery.

## Alternatives Considered

1. **Host/domain-based tenant resolution** — rejected as the canonical tenancy mechanism because it couples tenant identity to deployment routing and complicates on-premises and mobile operation.
2. **Deployment-specific tenant binding** — rejected because installation configuration should identify the backend endpoint, not the tenant authorization context.
3. **Client-supplied tenant ID** — rejected because client state is not an authoritative security boundary.
4. **Separate tenant membership system for every user** — not required for the current ERP model and would add identity complexity before a business requirement exists.
5. **Application-only tenant filtering** — rejected because database-level RLS provides essential defense in depth.
6. **Direct client-to-PostgreSQL connectivity** — rejected because database access must remain behind the ERP backend security boundary.

## Consequences

### Positive

- One tenancy lifecycle works for SaaS, on-premises, web, and mobile.
- Deployment URL and tenant identity are cleanly separated.
- On-premises installations do not require special tenant-resolution logic.
- Mobile clients use the same tenancy contract as web clients.
- The existing tenant-scoped user data model remains usable.
- PostgreSQL RLS remains a strong defense-in-depth boundary.
- The platform avoids maintaining two competing tenant-resolution architectures.

### Negative

- Authentication requires a deployment-independent login lookup before tenant-scoped user authentication.
- Duplicate active credentials across tenant accounts are ambiguous and fail closed.
- Tenant-scoped transactions must consistently establish database context.
- On-premises deployments must provide a reachable and secured backend endpoint for remote mobile access where required.

## Migration Requirements

The implementation must migrate to this architecture as a complete tenancy-flow change.

The following legacy mechanisms must be removed after the replacement is implemented and validated:

- host/domain tenant resolution;
- SaaS host tenant resolver;
- on-premises deployment tenant resolver;
- tenant host mapping configuration used as tenant authority;
- deployment tenant ID used as tenant authority;
- tenant resolution mode used for host/deployment resolution;
- bootstrap tenant discovery;
- routine client-authoritative `x-tenant-id` usage;
- stale tests and fixtures for the old resolution flow;
- stale documentation and `.ai` context describing the old flow.

## Verification Requirements

The implementation must prove at minimum:

- login establishes the correct tenant without a host header;
- login works through SaaS backend endpoint;
- login works through an on-premises backend endpoint;
- mobile and web use the same authentication contract;
- unauthorized credentials fail closed;
- ambiguous multiple tenant account matches fail closed;
- tenant session cannot be altered client-side;
- tenant-scoped transactions establish RLS context correctly;
- SELECT/INSERT/UPDATE/DELETE tenant isolation works as applicable;
- rollback does not leak tenant context;
- concurrent requests cannot leak tenant context through connection pooling;
- background jobs establish tenant context explicitly;
- no client connects directly to PostgreSQL.

## Related Architecture

- Multi-Tenant Architecture
- Backend Authentication and Authorization
- Database Security Architecture
- Frontend API Communication
- Deployment Architecture

# ADR-0006: Identity-Based Tenant Context and PostgreSQL RLS

**Date**: 2026-08-27  
**Status**: Approved  
**Approval Date**: 2026-08-27  
**Approved By**: Project Owner  
**Scope**: Authentication, tenant context, tenant isolation, web/mobile clients, SaaS and on-premises deployments

## Context

The Enterprise ERP Platform is a multi-tenant application that must operate consistently across SaaS, on-premises installations, web clients, and mobile clients.

The ERP deployment endpoint answers one question: **where is the ERP backend?** It may be a cloud API endpoint or a customer-controlled on-premises endpoint. It must not determine which tenant an authenticated user is authorized to operate in.

Tenant identity is an authorization concern. The authoritative relationship is between an authenticated user and the tenant memberships granted to that user. A user may belong to one or multiple tenants. When one active membership exists, the tenant may be selected automatically. When multiple memberships exist, the user must explicitly select the active tenant before tenant-scoped business operations begin.

The database must continue to provide defense-in-depth tenant isolation through PostgreSQL Row Level Security (RLS).

## Decision

The ERP will use **identity-based tenant context** as the canonical tenancy model.

The authoritative lifecycle is:

```text
Authenticate user
    ↓
Load active tenant memberships
    ↓
One tenant → auto-select
Multiple tenants → user selects tenant
    ↓
Validate membership
    ↓
Create tenant-scoped session
    ↓
Establish TenantContext
    ↓
Authorize business operation
    ↓
Begin tenant-scoped DB transaction
    ↓
SET LOCAL app.current_tenant_id
    ↓
Execute tenant-owned operation
    ↓
PostgreSQL RLS enforcement
```

Tenant context MUST NOT be derived from the request hostname, frontend URL, deployment configuration, client-selected arbitrary tenant identifier, or a deployment-specific tenant mapping.

The frontend and mobile application may store and send the authenticated session token and deployment API endpoint. The backend is authoritative for authentication, tenant membership, active tenant selection, authorization, and tenant context.

## Deployment Independence

Deployment and tenancy are separate concepts.

### SaaS

Clients connect to the centrally hosted ERP backend. After authentication, the backend resolves the user's tenant membership and establishes the tenant-scoped session.

### On-premises

The customer installation provides the ERP backend endpoint. Web and mobile clients are configured to connect to that endpoint, directly or through an approved network/VPN path. After authentication, tenant context is resolved from the user's membership exactly as in SaaS.

### Mobile

Mobile clients never connect directly to PostgreSQL. They connect only to the ERP backend API. The same authentication, tenant membership, session, authorization, TenantContext, transaction, and RLS rules apply regardless of where the backend is deployed.

## Tenant Membership Model

Tenant access is represented explicitly through tenant membership data.

Conceptually:

```text
users
  │
  └── tenant_memberships ──→ tenants
```

A membership must identify at least:

- user
- tenant
- membership status
- role or role reference as defined by authorization architecture

Membership validation is mandatory before an active tenant can be established.

## Session and Tenant Context

The tenant-scoped session is the trusted application-level source for the active tenant after authentication and membership validation.

The effective request context contains at minimum:

- authenticated user identity
- active tenant identity
- authenticated session identity
- authorization information required by the application

The backend must derive `TenantContext` from this trusted authenticated context. Client-supplied tenant identifiers are never authoritative.

If a user has multiple memberships, changing the active tenant requires a server-side membership check and creation or renewal of a tenant-scoped session/context. The user cannot switch tenants by modifying a request field or token claim locally.

## PostgreSQL RLS

PostgreSQL RLS remains mandatory for tenant-owned data.

Every tenant-scoped database operation must execute inside an explicit tenant-scoped transaction. Immediately after the transaction begins and before the first tenant-owned query or write, the application must execute:

```sql
SET LOCAL app.current_tenant_id = '<trusted tenant UUID>';
```

The tenant UUID must come from the canonical `TenantContext` established from the authenticated session and validated membership.

RLS is the final database enforcement boundary. Application authorization remains mandatory and RLS does not replace role or permission checks.

## Mandatory Invariants

- Authentication establishes user identity.
- Tenant membership establishes which tenants the user may access.
- An active tenant is selected only from validated memberships.
- A single membership may be auto-selected.
- Multiple memberships require explicit tenant selection before tenant-scoped business operations.
- Deployment location and URL identify the backend endpoint only; they do not identify the tenant.
- Hostname, custom domain, frontend state, headers, query parameters, or arbitrary client fields must not be authoritative tenant sources.
- A tenant-scoped session is required for tenant-scoped business operations.
- `TenantContext` is created only from trusted authenticated session context.
- Every tenant-owned database transaction must establish `SET LOCAL app.current_tenant_id` before tenant-owned access.
- RLS is mandatory for tenant-owned tables.
- Missing, invalid, expired, or unauthorized tenant context must fail closed.
- No default tenant, first-tenant fallback, hardcoded tenant, or implicit tenant selection is permitted except the explicit single-membership auto-selection rule.
- Mobile and web clients must use the same backend tenancy contract.
- PostgreSQL must never be directly exposed to web or mobile clients.
- Background jobs must establish tenant context explicitly from their trusted job payload or execution context.

## API Contract Principles

The API must expose authentication and tenant-selection operations independently from ordinary tenant-scoped business operations.

Conceptually:

```text
POST /auth/login
    ↓
Authenticate identity
    ↓
Return authenticated session information and available tenant memberships
```

If tenant selection is required:

```text
POST /auth/select-tenant
    ↓
Validate membership
    ↓
Create tenant-scoped session
```

After an active tenant session exists:

```text
Authorization: Bearer <session token>
    ↓
Authenticated principal
    ↓
Active tenant
    ↓
TenantContext
```

The exact route names may vary with the existing API conventions, but the security lifecycle is binding.

## Client Configuration

Clients require a deployment API endpoint.

For SaaS this normally points to the centrally hosted API.

For on-premises deployments this points to the customer installation's API endpoint, which may be reachable through the company LAN, approved VPN, or secured public HTTPS endpoint.

This endpoint configuration is connectivity configuration, not tenant configuration.

## Alternatives Considered

1. **Host/domain-based tenant resolution** — rejected as the canonical tenancy mechanism because it couples tenant identity to deployment routing and complicates on-premises and mobile operation.
2. **Deployment-specific tenant binding** — rejected because it couples installation configuration to tenant identity and does not provide a single tenancy lifecycle across deployment models.
3. **Client-supplied tenant ID** — rejected because client state is not an authoritative security boundary.
4. **Application-only tenant filtering** — rejected because database-level RLS provides essential defense in depth.
5. **Direct client-to-PostgreSQL connectivity** — rejected because database access must remain behind the ERP backend security boundary.

## Consequences

### Positive

- One tenancy lifecycle works for SaaS, on-premises, web, and mobile.
- Deployment URL and tenant identity are cleanly separated.
- Multi-tenant users are supported without URL-based routing.
- On-premises installations do not require special tenant-resolution logic.
- Mobile clients use the same tenancy contract as web clients.
- PostgreSQL RLS remains a strong defense-in-depth boundary.
- Tenant identity has a clear security authority: authenticated identity plus validated membership.

### Negative

- Authentication must load and manage tenant memberships.
- Multi-tenant users require a tenant-selection experience.
- Session management must safely represent the active tenant.
- Tenant-scoped transactions must consistently establish database context.
- On-premises deployments must provide a reachable and secured backend endpoint for remote mobile access where required.

## Migration Requirements

The implementation must migrate to this architecture as a complete tenancy-flow change.

The following legacy mechanisms are to be removed after the replacement is implemented and validated:

- host/domain-based tenant resolution
- SaaS host tenant resolver
- on-premises deployment tenant resolver when used to establish tenant identity
- tenant host mapping configuration used as an authoritative tenant source
- deployment tenant ID used as an authoritative tenant source
- tenant resolution mode used solely to select host/deployment tenant resolution
- bootstrap flows whose purpose is discovering tenant from deployment host
- routine client-supplied `x-tenant-id` authority
- documentation and tests describing the legacy tenant-resolution lifecycle

The migration is complete only when repository-wide search confirms that obsolete tenancy concepts are removed or retained only where they have a clearly documented non-authoritative purpose.

## Verification Requirements

The implementation must prove at minimum:

- single-tenant login automatically establishes the correct tenant
- multi-tenant login requires valid tenant selection
- unauthorized tenant selection fails
- expired/disabled membership fails closed
- tenant session cannot be altered client-side to access another tenant
- tenant-scoped transactions establish RLS context correctly
- SELECT/INSERT/UPDATE/DELETE tenant isolation works as applicable
- rollback does not leak tenant context
- concurrent requests cannot leak tenant context through connection pooling
- background jobs establish tenant context explicitly
- SaaS web access works
- on-prem web access works
- SaaS mobile access works
- on-prem mobile access works through the supported connectivity model
- no client connects directly to PostgreSQL

## Related Architecture

- Multi-Tenant Architecture
- Backend Authentication and Authorization
- Database Security Architecture
- API Architecture
- Deployment Architecture
- Identity and Access Management


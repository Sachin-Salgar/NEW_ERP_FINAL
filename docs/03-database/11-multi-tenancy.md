# 11. Multi-Tenant Architecture

## 11.1 Shared Database, Shared Schema

The platform serves multiple independent tenants from a shared PostgreSQL database using a shared schema model. Tenant-owned records are isolated by `tenant_id` and PostgreSQL Row Level Security (RLS).

## 11.2 Tenant Identity

The `tenant_id` (UUID) is the primary tenant isolation key. Every tenant-owned table must include this column unless explicitly exempted by the authoritative data model.

Tenant identity is a data and authorization concept. It is not derived from deployment hostname, frontend URL, installation location, or client-supplied fields.

## 11.3 Tenant Membership

Users obtain access to tenants through explicit tenant memberships.

Conceptually:

```text
User
  ↓
Tenant Membership
  ↓
Tenant
```

A user may have one or multiple active tenant memberships. Membership status and authorization are server-authoritative.

## 11.4 Request Lifecycle and Tenant Context

The canonical lifecycle is:

```text
Client connects to ERP backend endpoint
  ↓
Login / session authentication
  ↓
Authenticated Identity
  ↓
ERP User
  ↓
Load active Tenant Memberships
  ↓
One tenant → auto-select
Multiple tenants → user selects tenant
  ↓
Validate membership
  ↓
Tenant-scoped Session
  ↓
TenantContext
  ↓
Authorization
  ↓
Tenant-scoped Transaction
  ↓
SET LOCAL app.current_tenant_id
  ↓
PostgreSQL RLS
  ↓
Business operation
```

The backend is authoritative for tenant selection and context. A tenant-scoped database transaction must not begin until a valid authenticated tenant context exists.

## 11.5 Deployment Independence

Deployment answers **where the ERP backend is located**. Tenant identity answers **which organization the authenticated user is operating in**. These concerns are independent.

### SaaS

Web and mobile clients connect to the centrally hosted ERP backend. Authentication loads the user's tenant memberships and establishes the active tenant session.

### On-premises

The customer installation provides the ERP backend endpoint. The web frontend and mobile application are configured to connect to that endpoint directly, through the company LAN, through an approved VPN, or through a secured public HTTPS endpoint as permitted by the deployment. Authentication and tenant membership handling are identical to SaaS.

### Mobile

Mobile clients never connect directly to PostgreSQL. They communicate only with the ERP backend API. The backend determines and enforces tenant context.

## 11.6 Client Tenant Responsibilities

Clients may retain the active tenant information needed for UI state, display, and session handling, but client state is never authoritative.

The client must not:

- invent a tenant ID;
- select a tenant without backend membership validation;
- use hostname or URL as proof of tenant authorization;
- bypass tenant authorization with headers, query parameters, or local storage;
- connect directly to PostgreSQL.

## 11.7 Database Isolation (RLS)

PostgreSQL RLS is mandatory for tenant-owned tables.

The application must establish the trusted tenant context inside the same transaction that performs tenant-owned work:

```sql
BEGIN;
SET LOCAL app.current_tenant_id = '<trusted tenant UUID>';
-- tenant-owned queries/writes
COMMIT;
```

The tenant UUID must originate from the server-authoritative `TenantContext`, which originates from the authenticated tenant-scoped session and validated membership.

Example policy:

```sql
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON customer
USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

Policies must be designed for the required SELECT, INSERT, UPDATE, and DELETE behavior.

## 11.8 Transaction and Connection-Pool Safety

Tenant context must never leak between requests or jobs through a pooled connection. `SET LOCAL` is preferred because its lifetime is limited to the transaction.

All tenant-scoped repositories must use the common tenant-scoped transaction abstraction rather than manually setting persistent session state.

## 11.9 Cross-Tenant Safety

The implementation must fail closed when tenant context is absent, invalid, expired, or unauthorized.

Automated tests must prove:

- a tenant cannot read another tenant's records;
- a tenant cannot insert records for another tenant through normal application paths;
- updates and deletes cannot cross tenant boundaries;
- transaction rollback does not leak context;
- concurrent requests cannot leak tenant context through connection pooling;
- background jobs establish tenant context explicitly.

Platform administrative operations that legitimately cross tenant boundaries require explicit privileged authorization and must not be used as normal application execution paths.

## 11.10 Architecture Boundary

Business modules must consume the platform TenantContext and must not implement their own tenant discovery or tenant isolation mechanism.

Tenant isolation is a platform/database concern. Organization, branch, location, plant, role, and permission constraints are additional authorization dimensions within the active tenant and must never replace tenant isolation.

## Cross References

- [Backend Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)
- [Enterprise Security Architecture](../06-security/04-enterprise-security-architecture.md)
- [ADR-0006: Identity-Based Tenant Context and PostgreSQL RLS](../10-adr/0006-identity-based-tenant-context.md)

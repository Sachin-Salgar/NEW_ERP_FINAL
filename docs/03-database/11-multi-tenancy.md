# 11. Multi-Tenant Architecture

## 11.1 Shared Database, Shared Schema

The platform serves multiple independent tenants from a shared PostgreSQL database using a shared schema model. Tenant-owned records are isolated by `tenant_id` and PostgreSQL Row Level Security (RLS).

## 11.2 Tenant Identity

The `tenant_id` (UUID) is the primary tenant isolation key. Every tenant-owned table must include this column unless explicitly exempted by the authoritative data model.

Tenant identity is a data and authorization concept. It is not derived from deployment hostname, frontend URL, installation location, or client-supplied fields.

The current ERP user model is tenant-scoped:

```text
users.tenant_id → tenants.id
```

## 11.3 Identity-Based Tenant Discovery

Because the tenant is unknown before authentication, the backend uses a deployment-independent login lookup index:

```text
Login identifier
      ↓
auth_login_identifiers
      ↓
Candidate user_id + tenant_id
      ↓
Tenant-scoped users row
      ↓
Password verification
      ↓
Tenant-scoped session
```

The lookup index contains no password and does not grant authorization. It only identifies candidate tenant user accounts. The authoritative user record is read through the tenant-scoped repository after the candidate tenant is known.

A separate global tenant-membership model is not required for the current ERP architecture. Introducing one later requires a separate approved architectural decision.

## 11.4 Request Lifecycle and Tenant Context

```text
Client connects to ERP backend endpoint
  ↓
Login identifier + password
  ↓
Deployment-independent login lookup
  ↓
Candidate tenant user account
  ↓
Tenant-scoped user authentication
  ↓
Exactly one active credential match
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

The backend is authoritative for tenant selection and context. Tenant-scoped business operations cannot begin without a valid tenant-scoped session.

## 11.5 Deployment Independence

Deployment answers **where the ERP backend is located**. Tenant identity answers **which tenant the authenticated user account belongs to**. These concerns are independent.

### SaaS

Web and mobile clients connect to the centrally hosted ERP backend. Login discovers the tenant from the authenticated user account.

### On-premises

The customer installation provides the ERP backend endpoint. The web frontend and mobile application are configured to connect to that endpoint through the company LAN, approved VPN, or secured public HTTPS deployment path. Authentication and tenant handling are identical to SaaS.

### Mobile

Mobile clients never connect directly to PostgreSQL. They communicate only with the ERP backend API.

## 11.6 Client Tenant Responsibilities

Clients may retain active tenant information for UI state and display, but client state is never authoritative.

The client must not:

- invent a tenant ID;
- use a URL or hostname as proof of tenant authorization;
- override the tenant in a request header or body;
- bypass backend authentication;
- connect directly to PostgreSQL.

## 11.7 Database Isolation (RLS)

PostgreSQL RLS is mandatory for tenant-owned tables.

The application must establish trusted tenant context inside the same transaction that performs tenant-owned work:

```sql
BEGIN;
SET LOCAL app.current_tenant_id = '<trusted tenant UUID>';
-- tenant-owned queries/writes
COMMIT;
```

The tenant UUID must originate from the server-authoritative `TenantContext` created from the authenticated tenant-scoped session.

Example policy:

```sql
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON customer
USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

## 11.8 Transaction and Connection-Pool Safety

Tenant context must never leak between requests or jobs through a pooled connection. `SET LOCAL` is preferred because its lifetime is limited to the transaction.

All tenant-scoped repositories must use the common tenant-scoped transaction abstraction rather than persistent session state.

## 11.9 Cross-Tenant Safety

The implementation must fail closed when tenant context is absent, invalid, expired, or unauthorized.

Automated tests must prove:

- a tenant cannot read another tenant's records;
- tenant-owned inserts/updates/deletes cannot cross tenant boundaries;
- rollback does not leak context;
- concurrent requests cannot leak context through connection pooling;
- background jobs establish tenant context explicitly.

## 11.10 Architecture Boundary

Business modules consume the platform TenantContext and must not implement their own tenant discovery or tenant isolation mechanism.

Organization, branch, location, plant, role, and permission constraints are additional authorization dimensions within the active tenant and never replace tenant isolation.

## Cross References

- [Backend Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)
- [Enterprise Security Architecture](../06-security/04-enterprise-security-architecture.md)
- [ADR-0006: Identity-Based Tenant Context and PostgreSQL RLS](../10-adr/0006-identity-based-tenant-context.md)

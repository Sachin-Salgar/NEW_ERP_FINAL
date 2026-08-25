# 11. Multi-Tenant Architecture

## 12.1 Shared Database, Shared Schema
The platform serves multiple independent organizations from a single PostgreSQL database using a shared schema model.

## 12.5 Tenant Identification
The `tenant_id` (UUID) is the primary isolation key. Every tenant-owned table **must** include this column.

## 12.6 Request Lifecycle and Tenant Context
The tenant lifecycle is part of the platform security boundary and follows the order below:

```text
ERP URL / Deployment Host
  ↓
Tenant Resolver (SaaS host or on-prem installation config)
  ↓
Bootstrap / deployment metadata
  ↓
Login
  ↓
Authentication
  ↓
Authenticated Identity
  ↓
ERP User
  ↓
Organization Membership Resolution
  ↓
Active Organization Resolution
  ↓
Tenant Resolution
  ↓
TenantContext
  ↓
Tenant-scoped Transaction
  ↓
SET LOCAL app.current_tenant_id
  ↓
PostgreSQL RLS
  ↓
Authorization
  ↓
Location / Plant Context (if applicable)
  ↓
Business operation
```

The application must resolve the canonical tenant and organization context before beginning a tenant-scoped database transaction. For SaaS deployments, the authoritative tenant is obtained from the request hostname, subdomain, or custom domain. For on-premises deployments, the tenant is resolved from trusted installation configuration. The request must fail closed when the context is missing or invalid. No fallback tenant, default tenant, or hardcoded tenant ID is allowed for normal tenant-scoped operations.

`TenantContext` represents the already-resolved tenant and organization scope for the current request. It is not inferred from arbitrary business data, not silently replaced by a default tenant, and not selected after a tenant-scoped transaction has started.

## 12.7 Tenant Resolution Mechanism
The repository architecture distinguishes between deployment-specific tenant resolution and user authentication.

- **SaaS**: the browser URL / custom domain / hostname is the trusted deployment input used to resolve the tenant before login.
- **On-premises**: the ERP installation configuration binds the deployment endpoint to the authoritative tenant.
- **Frontend**: the client discovers the backend endpoint and may obtain bootstrap metadata, but the client does not own the tenant decision.
- **Backend**: the backend resolves and validates the tenant, then verifies the authenticated user has active membership in that tenant.

A client-provided `tenant_id` is never treated as authoritative for normal login or request processing.

## 12.8 Hard Isolation (RLS)
We mandate **PostgreSQL Row Level Security (RLS)** as a non-bypassable security layer (see [ADR-0006](../10-adr/0006-postgresql-rls-tenancy.md)).

### Implementation Rule:
```sql
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON customer
USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

The application must call `SET LOCAL app.current_tenant_id` inside the tenant-scoped transaction before the first tenant-owned read or write. The value must come from the resolved `TenantContext`, not from a client-supplied value or a default fallback.

## 12.13 Cross-Tenant Safety
- Backend connection pools set the session variable per request.
- Automated tests must verify that `tenant_id` leakage is impossible.
- Platform admin queries require explicit escalation roles.
- A request without a valid tenant context shall not execute tenant-scoped database operations.
- Tenant isolation must remain enforced even when application-level tenant filtering is accidentally omitted.

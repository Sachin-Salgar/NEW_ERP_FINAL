# 16. Security Architecture

## 23.3 Defense in Depth
Security is enforced at multiple layers: Network -> IAM -> App Logic -> Database RLS.

The tenant model is a single shared PostgreSQL database with tenant isolation enforced by PostgreSQL RLS. The database is not split by plant or location. Multiple organizations and locations operate within the same shared database, with tenant and organization context resolved on the server before any tenant-scoped transaction begins.

### Tenant Resolution and Transaction Ordering
```text
Authenticated identity
  ↓
Tenant resolver (hostname/custom domain or installation config)
  ↓
Authorized organization membership
  ↓
Resolved tenant + organization context
  ↓
TenantContext
  ↓
Transaction
  ↓
SET LOCAL app.current_tenant_id
  ↓
PostgreSQL RLS
```

This ordering is mandatory. `tenant_id` and `organization_id` must not be accepted from an unauthenticated client as proof of authorization. A client-provided tenant value must never override the deployment-resolved tenant or the backend-validated membership.

## 23.7 Encryption
- **In Transit**: Mandatory TLS 1.3 for all database connections.
- **At Rest**: Storage-level encryption (TDE or Cloud Provider encryption).
- **Sensitive Fields**: Application-level encryption for PII, API Keys, or Credentials.

## 23.9 Password Policy
Passwords must **never** be stored in the database. Use `argon2id` or `bcrypt` hashes.

## 23.10 SQL Injection
- Mandatory use of Parameterized Queries (via Drizzle ORM).
- Direct string concatenation in SQL is strictly prohibited.

## 23.13 Administrative Access
- Production DB access requires **Break-glass** protocols.
- No shared accounts.
- Audit logging enabled for all `SUPERUSER` actions.

## 23.14 Tenant, Organization, and Location Context
The project architecture requires the following domain boundaries:

- **Tenant**: primary security and data-isolation boundary.
- **Organization**: legal/business entity within the tenant.
- **Location / Plant / Branch**: operational unit under the organization.
- **Membership**: user-to-tenant or user-to-organization authorization relationship.
- **Location access**: user permission to operate within specific locations.

Location data and location access are authorization context, not tenant replacement. A user changing working location remains within the same tenant and business organization unless the backend explicitly resolves a new organization context.

No default tenant, fallback tenant, or hardcoded tenant identifier is permitted for standard business operations. Recovery from a missing or invalid tenant context must fail closed.

# 16. Security Architecture

## 23.3 Defense in Depth
Security is enforced at multiple layers: Network -> IAM -> App Logic -> Database RLS.

The tenant model is a single shared PostgreSQL database with tenant isolation enforced by PostgreSQL RLS. Branch is the only business subdivision below Tenant; inventory warehouses and other domain-specific physical locations are modeled only where the business domain requires them.

### Tenant Resolution and Transaction Ordering
```text
Authenticated identity
  ↓
Tenant-scoped session / authenticated user context
  ↓
Tenant membership and branch authorization where required
  ↓
Resolved tenant context with domain-specific branch authorization
  ↓
TenantContext
  ↓
Transaction
  ↓
SET LOCAL app.current_tenant_id
  ↓
PostgreSQL RLS
```

This ordering is mandatory. Tenant authority comes from the authenticated session and backend-validated user membership. Client-supplied tenant or branch identifiers do not become the security boundary. The backend validates branch authorization only for operations whose domain requires it and fails closed when authorization is invalid.

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

## 23.14 Tenant and Branch Context
The project architecture requires the following domain boundaries:

- **Tenant**: primary security and data-isolation boundary.
- **Branch**: operational/statutory subdivision directly under the tenant.
- **Membership**: user-to-tenant authorization relationship.
- **Branch access**: application/domain authorization for operations that require a branch.

Branch is not a tenant or RLS boundary. A branch-aware operation remains within the authenticated tenant, and backend authorization is authoritative.

No default tenant, fallback tenant, or hardcoded tenant identifier is permitted for standard business operations. Recovery from a missing or invalid tenant context must fail closed.

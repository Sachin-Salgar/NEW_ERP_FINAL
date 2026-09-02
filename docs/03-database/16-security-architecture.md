# 16. Security Architecture

## 23.3 Defense in Depth
Security is enforced at multiple layers: Network -> IAM -> App Logic -> Database RLS.

The tenant model is a single shared PostgreSQL database with tenant isolation enforced by PostgreSQL RLS. The database is not split by plant or location. Multiple organizations and locations operate within the same shared database, with tenant and organization context resolved on the server before any tenant-scoped transaction begins.

### Tenant Resolution and Transaction Ordering
```text
Authenticated identity
  ↓
Tenant-scoped session / authenticated user context
  ↓
Authorized organization / branch / location membership
  ↓
Resolved tenant + organization + branch + location context
  ↓
TenantContext
  ↓
Transaction
  ↓
SET LOCAL app.current_tenant_id
  ↓
PostgreSQL RLS
```

This ordering is mandatory. Tenant authority comes from the authenticated session and backend-validated user membership. Client-supplied `tenant_id`, `organization_id`, `branch_id`, or `location_id` values do not become the security boundary. The backend validates the full context tuple before it becomes active and fails closed when a combination is invalid.

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

## 23.14 Tenant, Organization, Branch, and Location Context
The project architecture requires the following domain boundaries:

- **Tenant**: primary security and data-isolation boundary.
- **Organization**: legal/business entity within the tenant.
- **Branch**: operational business unit under the organization.
- **Location**: physical operating site or plant under the organization.
- **Membership**: user-to-tenant or user-to-organization authorization relationship.
- **Branch access** and **Location access**: user permission to operate within specific operational contexts.

Branch and Location are siblings under Organization. They are not parent/child and are not interchangeable. The effective working context is the complete tuple `tenantId + organizationId + branchId + locationId`. A user changing working context remains within the same tenant unless the backend explicitly resolves a different authorized tenant-scoped session. The backend is authoritative for authorization and context switching; a failed switch preserves the previous valid context.

No default tenant, fallback tenant, or hardcoded tenant identifier is permitted for standard business operations. Recovery from a missing or invalid tenant context must fail closed. The migration `0006-default-location-context.sql` adds persisted default location support using `users.default_location_id` and retains a tenant-safe relationship for authorization.

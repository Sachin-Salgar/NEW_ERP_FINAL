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

## 23.15 Platform procedure ownership

Platform lifecycle procedures are `SECURITY DEFINER` and are owned by the
non-login `erp_procedure_owner` role. The dedicated `erp_platform_executor`
role is login-capable and receives only schema usage plus EXECUTE on the two
approved platform lifecycle procedures.

Database role normalization, lifecycle-function ownership, RLS policy
installation, grants, and invariant verification are part of the canonical
database provisioning pipeline defined by `.ai/contracts/database-provisioning.md`.
The repository entry point is `npm run db:provision`; the compiled deployment
entry point is `npm run db:provision:compiled`.

The provisioning pipeline uses three credential boundaries:
- `DB_PROVISIONING_DATABASE_URL`: privileged operator used for security/RLS
  bootstrap and final verification.
- `DB_MIGRATION_DATABASE_URL`: the object-creating migration role, normally
  `erp`.
- `DATABASE_URL`: runtime application connection, normally `erp_app`.

The provisioning pipeline must never expose the privileged operator credential
to the application runtime. `PLATFORM_SECURITY_DATABASE_URL` is legacy
configuration and is not part of the canonical architecture.

The canonical sequence is:

```text
preflight
  → migrations
  → platform security/RLS bootstrap
  → platform administrator bootstrap
  → final verification
  → database ready
```

The role contract remains explicit: `erp` is the migration/object-creating
role (`LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `CREATEROLE`,
`NOREPLICATION`, `NOBYPASSRLS}); `erp_app` is the non-privileged runtime
role; `erp_procedure_owner` is NOLOGIN and owns the lifecycle procedures; and
`erp_platform_executor` is the separate LOGIN identity granted EXECUTE only
on those procedures.

The provisioning verifier must fail closed when role attributes, memberships,
function ownership/security, grants, or RLS state violate this contract.

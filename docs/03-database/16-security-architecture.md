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

Role attributes, role memberships, and ownership-transfer authority are
database-administration responsibilities handled by the privileged
`scripts/platform-security.sql` bootstrap. Migration `0009` creates the
dedicated roles when needed, installs the guarded function definitions, and
applies the narrow grants. The production command is
`PLATFORM_SECURITY_DATABASE_URL=<privileged operator URL> npm run
db:security-bootstrap`; it runs the bootstrap and invariant verification in one
transaction. The operator URL must use a PostgreSQL superuser or managed-provider
equivalent authorized to normalize roles, memberships, ownership, and grants.
It is separate from `DATABASE_URL` and is never provided to the application
runtime. The bootstrap must run after migration
`0009` and before application startup. Startup independently verifies the same
invariants and refuses to serve traffic when they are incomplete. The normal
migration role must never retain membership in `erp_procedure_owner` after
bootstrap.

The role contract is explicit: `erp` is the migration/database-owner-side
role (`LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `CREATEROLE`,
`NOREPLICATION`, `NOBYPASSRLS`); `erp_app` is the non-privileged integration
application role (`LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`,
`NOREPLICATION`, `NOBYPASSRLS`, with no public-schema CREATE privilege);
`erp_procedure_owner` is NOLOGIN/NOBYPASSRLS and owns the two lifecycle
procedures; and `erp_platform_executor` is the separate LOGIN identity granted
EXECUTE only on those procedures. `PLATFORM_SECURITY_DATABASE_URL` is used only
by the release operator and is not an application credential.

The bootstrap operator must be a PostgreSQL superuser or a managed-provider
equivalent with authority to alter these role attributes, revoke role
memberships, alter default privileges, transfer lifecycle-function ownership,
and grant/revoke schema, table, sequence, and function privileges. CI uses a
disposable superuser bootstrap role distinct from the disposable `erp`
migration role; production must preserve the same credential separation.

Default privileges are configured for the object-creating migration role with
`ALTER DEFAULT PRIVILEGES FOR ROLE erp`; the bootstrap operator is not the owner
of that default-privilege configuration. `erp_app` is a runtime role and is not
an object-creating role, so no `ALTER DEFAULT PRIVILEGES FOR ROLE erp_app`
operation is required. Public, application, executor, and procedure-owner
grants are removed for future tables, sequences, and functions created by
`erp`. The bootstrap also
normalizes `erp_app` to its explicit integration baseline (DML on current
tables and `USAGE/SELECT/UPDATE` on current sequences); test fixtures may
reapply those grants after bootstrap.

Dedicated roles are normalized in both membership directions: no role may be
granted to `erp_procedure_owner` or `erp_platform_executor`, and neither
dedicated role may be a member of another role. Lifecycle-function ownership
converges automatically to `erp_procedure_owner`. Ownership drift for unrelated
application objects remains detect-only because the architecture does not
define a safe universal replacement owner; bootstrap fails closed rather than
transferring such objects arbitrarily.

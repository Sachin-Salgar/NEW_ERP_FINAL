# ADR-0006: PostgreSQL Row Level Security (RLS) for Tenancy

**Date**: 2026-08-07  
**Status**: Approved  
**Approval Date**: 2026-08-07  
**Approved By**: Architecture Review Board  
**Scope**: Tenant isolation for tenant-owned PostgreSQL data

## Context

The Enterprise ERP Platform uses a shared-database, shared-schema multi-tenant architecture. Application-level tenant filtering is necessary but is vulnerable to implementation mistakes such as a missing tenant predicate.

The project architecture also defines a single product operating across both SaaS and on-premises deployments. SaaS resolves the tenant from the request domain/hostname or custom domain; on-premises resolves it from trusted installation configuration. The tenant is established before login and before the user is authorized for tenant-scoped business operations.

PostgreSQL Row Level Security (RLS) provides an additional database enforcement layer for tenant-owned data.

## Decision

We will mandate **PostgreSQL RLS for tenant isolation** as a database enforcement layer in addition to application-level authorization and tenant scoping.

The database architecture requires the application to resolve the active tenant and organization context before any tenant-scoped transaction begins. The request must establish a valid deployment-resolved `TenantContext`, then open the transaction and execute `SET LOCAL app.current_tenant_id` before the first tenant-owned query or write. This tenant is authoritative for the request and can be derived from a SaaS hostname/custom domain or from trusted on-prem installation configuration; it is not taken from a user-editable client field.

RLS is therefore a final enforcement barrier, not a replacement for identity, tenant resolution, or authorization. Organization and location constraints are evaluated as authorization context within the already-established tenant boundary.

## Mandatory Tenant Isolation Invariants

The following rules are binding for all implementations of this ADR:

- Authentication and tenant resolution are different processes.
- A user identity does not automatically authorize access to every tenant or organization.
- The tenant is resolved from trusted deployment metadata, not from frontend state or a user-supplied tenant ID.
- Organization membership is resolved after authentication and validated before the effective request context is accepted.
- Location / plant / branch access is evaluated after tenant + organization context has been established and must never replace tenant isolation.
- `TenantContext` is created only after deployment tenant resolution, authentication, and membership validation succeed.
- The database transaction begins only after a valid `TenantContext` exists.
- `SET LOCAL app.current_tenant_id` occurs inside the transaction before any tenant-owned read or write.
- RLS remains mandatory. Application authorization is still required.
- Missing or invalid tenant context must fail closed.
- No default tenant, fallback tenant, hidden tenant alias, or “first tenant” selection is permitted for routine business operations.

## Rationale

- **Defense in depth**: Database policies reduce the impact of application filtering mistakes.
- **Centralized enforcement**: Tenant policies are defined with the database schema rather than duplicated in every endpoint.
- **Auditability**: Tenant-isolation behavior can be reviewed and tested at the database layer.

## Alternatives Considered

1. **Schema-per-tenant** — increases schema-management and migration complexity as tenant count grows.
2. **Database-per-tenant** — provides stronger physical isolation but has substantially greater operational overhead and is not the default architecture.
3. **Application-only isolation** — simpler database configuration but exposes the system to tenant-filtering defects.

## Consequences

### Positive

- Stronger protection against accidental cross-tenant reads and writes.
- Reduced dependence on every individual query remembering tenant predicates.
- Clear database-level tenant boundary.

### Negative

- Session tenant context must be established safely and consistently.
- RLS adds query-planning and policy complexity.
- Native SQL, background jobs, migrations, administrative access, and connection pooling require explicit handling.

## Implementation Notes

- Tenant-owned tables shall enable RLS and define policies appropriate to their ownership model.
- Policies shall derive tenant context from a controlled database session/transaction context.
- The application must establish tenant context **before any tenant-scoped database transaction begins** and before tenant-owned business operations execute.
- `SET LOCAL app.current_tenant_id` must occur inside the tenant-scoped transaction, immediately after the transaction begins and before the first tenant-owned query or write.
- The transaction must receive the resolved tenant ID from the canonical `TenantContext`; it must not use a default, fallback, or hardcoded tenant value.
- Connection pools must never allow one request's tenant context to remain active for a subsequent request.
- RLS policies must be tested for SELECT, INSERT, UPDATE, and DELETE behavior as applicable.
- Background jobs must establish tenant context explicitly; they must not rely on a user request session.
- Privileged roles that can bypass RLS must be tightly restricted and governed. Such roles are administrative exceptions, not normal application execution paths.
- Application authorization remains required; RLS does not replace role/permission checks.
- A request without a valid tenant context must fail closed and must not execute tenant-scoped operations.

## Related Documents

- [Multi-Tenant Architecture](../03-database/11-multi-tenancy.md)
- [Database Security Architecture](../03-database/16-security-architecture.md)
- [Backend Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)

## References

- PostgreSQL Row Level Security documentation

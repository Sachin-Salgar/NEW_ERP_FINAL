# ADR-0006: PostgreSQL Row Level Security (RLS) for Tenancy

**Date**: 2026-08-07  
**Status**: Approved  
**Approval Date**: 2026-08-07  
**Approved By**: Architecture Review Board  
**Scope**: Tenant isolation for tenant-owned PostgreSQL data

## Context

The Enterprise ERP Platform uses a shared-database, shared-schema multi-tenant architecture. Application-level tenant filtering is necessary but is vulnerable to implementation mistakes such as a missing tenant predicate.

PostgreSQL Row Level Security (RLS) provides an additional database enforcement layer for tenant-owned data.

## Decision

We will mandate **PostgreSQL RLS for tenant isolation** as a database enforcement layer in addition to application-level authorization and tenant scoping.

RLS is not the sole security boundary: privileged database roles, migrations, administration, and other controlled infrastructure paths must be explicitly governed.

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
- The application must establish tenant context **after acquiring a connection and before tenant-owned business operations**, preferably transaction-locally to prevent context leakage through connection pooling.
- Connection pools must never allow one request's tenant context to remain active for a subsequent request.
- RLS policies must be tested for SELECT, INSERT, UPDATE, and DELETE behavior as applicable.
- Background jobs must establish tenant context explicitly; they must not rely on a user request session.
- Privileged roles that can bypass RLS must be tightly restricted and governed. Such roles are administrative exceptions, not normal application execution paths.
- Application authorization remains required; RLS does not replace role/permission checks.

## Related Documents

- [Multi-Tenant Architecture](../03-database/11-multi-tenancy.md)
- [Database Security Architecture](../03-database/16-security-architecture.md)
- [Backend Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)

## References

- PostgreSQL Row Level Security documentation

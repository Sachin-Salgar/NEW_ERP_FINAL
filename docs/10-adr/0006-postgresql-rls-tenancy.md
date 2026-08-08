# ADR-0006: PostgreSQL Row Level Security (RLS) for Tenancy

**Date**: 2026-08-07
**Status**: Approved
**Approval Date**: 2026-08-07
**Approved By**: Architecture Review Board

## Context

The Enterprise ERP Platform uses a Shared Database, Shared Schema multi-tenant architecture. While application-level filtering is common, it is prone to human error (forgetting a `WHERE tenant_id = ?` clause), which can lead to critical cross-tenant data exposure.

## Decision

We will mandate **PostgreSQL Row Level Security (RLS)** as a secondary, non-bypassable layer for tenant isolation.

## Rationale

- **Defense in Depth**: Isolation is enforced at the database level, providing a safety net if application logic fails.
- **Centralized Security**: Security policies are defined once in the schema rather than duplicated across many API endpoints.
- **Compliance**: Simplifies auditing and meeting strict data isolation regulatory requirements.

## Alternatives Considered

1. **Schema-per-tenant**: Harder to manage at scale (thousands of schemas), complicates cross-tenant reporting for platform admins, and higher infrastructure overhead.
2. **Database-per-tenant**: Extremely high cost and management overhead; overkill for most SMB tenants.
3. **Application-only isolation**: High risk of developer error leading to data breaches.

## Consequences

### Positive
- Hardened multi-tenant security.
- Reduced risk of data leaks in reporting and analytics.
- Simplified backend queries (the database automatically applies filters).

### Negative
- Slight performance overhead on queries.
- Complexity in managing database session context (must set tenant ID in the session).
- Some complexity with native SQL and background jobs.

## Implementation Notes

- Every tenant-owned table must have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- A policy `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)` must be applied.
- Backend connection pools must set this session variable after acquiring a connection and before executing business logic.

## Related Documents

- [Multi-Tenant Architecture](../03-database/11-multi-tenancy.md)
- [Database Security Architecture](../03-database/16-security-architecture.md)

## References

- PostgreSQL Row Level Security Documentation

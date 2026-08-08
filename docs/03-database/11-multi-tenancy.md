# 11. Multi-Tenant Architecture

## 12.1 Shared Database, Shared Schema
The platform serves multiple independent organizations from a single PostgreSQL database using a shared schema model.

## 12.5 Tenant Identification
The `tenant_id` (UUID) is the primary isolation key. Every tenant-owned table **must** include this column.

## 12.8 Hard Isolation (RLS)
We mandate **PostgreSQL Row Level Security (RLS)** as a non-bypassable security layer (see [ADR-0006](../10-adr/0006-postgresql-rls-tenancy.md)).

### Implementation Rule:
```sql
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON customer
USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

## 12.13 Cross-Tenant Safety
- Backend connection pools set the session variable per request.
- Automated tests must verify that `tenant_id` leakage is impossible.
- Platform admin queries require explicit escalation roles.

# ADR-0012 — Branch Access Representation

- **Status:** Approved
- **Date:** 2026-09-08
- **Scope:** Tenant-scoped application authorization for Branch records

## Context

Branch is the operational, statutory, business, or reporting subdivision
inside a Tenant:

```text
Platform
  └── Tenant
       └── Branch
```

Tenant remains the identity, ownership, authorization, data-isolation, and
PostgreSQL RLS boundary. Branch access is an application/domain authorization
dimension within that boundary. Branch access must never be interpreted as a
second Tenant, database, or RLS context.

## Decision

Branch access is represented by a tenant-scoped authorization relationship
between the authenticated user and the requested Branch. The relationship
must establish that:

1. the authenticated user belongs to the Tenant through `tenant_memberships`;
2. the requested Branch belongs to the authenticated Tenant;
3. the access relationship identifies the authenticated user and requested
   Branch; and
4. the Branch satisfies the current Branch lifecycle and requested domain
   operation rules when those checks are required by the domain contract.

The repository representation is a tenant-safe user-to-Branch access
assignment. Its exact persistence columns and constraints are defined by the
current schema and migrations; authorization code must not invent lifecycle
fields or infer access from unrelated domain tables.

Branch authorization is evaluated only after automatic Tenant context has been
established. A client-supplied Branch identifier can select the subject of a
domain operation, but cannot select or change Tenant context.

## Authorization flow

```text
Authenticated identity
  ↓
tenant_memberships
  ↓
Automatic Tenant context
  ↓
Tenant authorization
  ↓
Tenant-scoped Branch access relationship
  ↓
Branch-aware application operation
  ↓
Tenant transaction and PostgreSQL RLS
```

Every tenant-scoped query remains protected by `tenant_id` and PostgreSQL RLS.
Branch access adds application/domain authorization; it does not replace the
tenant predicate, establish a database session context, or create a new RLS
policy boundary.

## Non-goals and boundaries

- There is no Organization hierarchy above Branch.
- There is no generic Location hierarchy or Location access model in the
  platform context architecture.
- Inventory warehouses, storage locations, bins, and similar physical
  structures remain owned by their bounded business domain.
- There is no Tenant selector or switching flow for normal application users.
- Frontend branch state is presentation state only; backend authorization is
  authoritative.

## Consequences

- Branch access is explicit, tenant-safe, and auditable.
- Revoking Branch access removes or disables the approved access relationship
  according to the current domain contract.
- Cross-Tenant Branch access is rejected before the business operation.
- Branch-aware operations remain subject to Tenant membership, permission
  checks, and PostgreSQL RLS.
- Domain modules may require Branch access without making Branch an isolation
  boundary.

## Validation

Validation must prove:

- a user with valid Tenant membership can access only permitted Branches;
- a user cannot access a Branch belonging to another Tenant;
- missing or revoked Branch access is denied;
- Branch identifiers cannot override Tenant context;
- PostgreSQL RLS still prevents cross-Tenant reads and writes;
- unrelated inventory/storage location concepts are not used as platform
  authentication or authorization context.

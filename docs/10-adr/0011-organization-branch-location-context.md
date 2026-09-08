# ADR-0011 — Tenant and Branch Context Architecture

- **Status:** Approved
- **Date:** 2026-09-08
- **Scope:** Platform, Tenant, Branch, authentication context, request/session context, and domain authorization

## Context

The ERP requires one unambiguous hierarchy for normal application access:

```text
Platform
  └── Tenant
       └── Branch
            └── ERP business data
```

Platform is the system-level administration boundary. Tenant is the ERP
account/company boundary and owns tenant membership, module entitlement,
tenant-wide configuration, tenant data isolation, and PostgreSQL RLS context.
Branch is an operational, statutory, business, or reporting subdivision inside
a Tenant.

Branch is not a Tenant, database, security, or RLS boundary. A domain may use
`branch_id` when branch-specific authorization or business behavior is
required, but Branch access never replaces `tenant_id`.

Inventory concepts such as warehouses, storage locations, bins, and other
physical stock structures remain legitimate bounded-domain concepts. They are
not generic authentication, security, or working-context levels.

## Decision

An application user belongs to exactly one Tenant through `tenant_memberships`.
After credential verification, the backend derives Tenant context automatically
from the authenticated identity and trusted membership state. The normal user
flow does not contain a Tenant selector, Tenant switching, or multi-Tenant
context selection.

The authenticated request/session context contains the server-established
Tenant identity and authentication/session claims. A request may carry a
domain-specific Branch identifier where the operation requires one, but the
backend must validate that Branch authorization inside the already established
Tenant context. Client-supplied identifiers never establish Tenant authority.

The backend authorization sequence is:

```text
Authenticated identity
  ↓
tenant_memberships
  ↓
Automatic Tenant context
  ↓
Tenant authentication and authorization
  ↓
Branch authorization where required
  ↓
ERP application operation
  ↓
Tenant transaction with PostgreSQL RLS
```

Tenant-owned database work establishes trusted transaction-local tenant
context, including `app.current_tenant_id`, before tenant queries or writes.
PostgreSQL RLS enforces tenant isolation. Branch authorization is an
application/domain decision inside that Tenant boundary and is not an RLS
context.

There is no Organization entity in this architecture. There is no generic
Location entity, generic Location context, Organization context, Organization
selector, or Location selector. A physical warehouse or storage location may
be modeled only by the bounded domain that owns it.

## Request and session contract

- Login establishes one Tenant automatically and routes the normal user to the
  authenticated application.
- Sessions and JWTs carry server-established Tenant claims; they do not accept
  client-selected Tenant context.
- Tenant membership revocation, session invalidation, and authorization failure
  fail closed.
- Branch claims or identifiers are used only when defined by the domain
  contract and remain subordinate to Tenant authorization.
- Platform sessions and permissions are separate from normal Tenant sessions.
- Web and mobile clients connect to the configured ERP backend and never
  connect directly to PostgreSQL.

## Consequences

- Tenant is the single ownership, security, authorization, and RLS boundary.
- Branch supports operational and statutory distinctions without introducing
  another isolation boundary.
- Normal authentication is deterministic and does not require context
  selection.
- Domain-specific physical locations remain inside Inventory or another owning
  bounded module rather than becoming platform context.
- Implementations must not introduce Organization hierarchy, Organization
  membership, generic Location hierarchy, Tenant switching, or context
  selectors.

## Validation

Validation must prove:

- automatic Tenant establishment from authenticated identity and membership;
- direct normal login without a Tenant selector;
- denial of missing or revoked Tenant membership;
- branch authorization within the authenticated Tenant;
- no cross-Tenant access through application queries or PostgreSQL RLS;
- Branch identifiers cannot change Tenant context;
- platform administration remains separate from Tenant application access.

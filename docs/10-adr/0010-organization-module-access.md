# ADR-0010 — Tenant Module Entitlement and Access

- **Status:** Approved
- **Date:** 2026-09-08
- **Scope:** Tenant-level module entitlement, authentication context, and permission-gated module access

## Context

The ERP has two distinct authorization concerns:

1. `tenant_modules` records which business modules a Tenant is entitled to use.
2. Tenant roles and permissions determine which authenticated users may perform
   actions within an entitled module.

Tenant is the ERP account/company, security, authorization, and PostgreSQL RLS
boundary. A normal application user belongs to exactly one Tenant through
`tenant_memberships`. Normal login establishes that Tenant automatically from
trusted authenticated identity and membership state.

Module entitlement must not be derived from deployment configuration, client
input, Branch access, or an individual user's permissions. Branch is an
operational subdivision below Tenant and is not a module-entitlement or RLS
boundary.

## Decision

Module entitlement is owned by Tenant and represented by `tenant_modules`.
There is no `organization_modules`, no Organization-level module boundary, and
no Organization membership or context model.

Runtime access to a protected module requires all applicable conditions:

1. the authenticated session establishes a valid Tenant;
2. the Tenant has the module enabled or entitled in `tenant_modules`;
3. the authenticated user has the required tenant permission through the
   tenant's roles and permission assignments;
4. any additional Branch authorization required by the domain operation passes.

Tenant bootstrap and tenant administration provision or maintain tenant-level
module entitlements according to the approved module catalog. Core platform
behavior must not create a second module boundary below Tenant.

Frontend module visibility is only a user-experience optimization. Backend
authorization remains authoritative, and PostgreSQL RLS remains the final
Tenant-isolation boundary for tenant-owned data.

## Current authorization flow

```text
Authenticated identity
  ↓
tenant_memberships
  ↓
Automatic Tenant context
  ↓
tenant_modules entitlement
  ↓
Tenant role and permission evaluation
  ↓
Branch authorization where the domain requires it
  ↓
Backend module operation
  ↓
Tenant transaction and PostgreSQL RLS
```

There is no Tenant selector or switching flow. The client cannot select a
Tenant or module entitlement through a request body, query parameter, header,
URL, or local state. A missing, invalid, revoked, or unauthorized Tenant
context fails closed.

## Consequences

- Module entitlement has one clear owner: Tenant.
- `tenant_modules` and RBAC remain separate but composable access controls.
- A permission cannot make a module available when the Tenant is not entitled.
- Branch authorization can constrain an operation without becoming a second
  security boundary.
- The design avoids Organization-level enablement, Organization membership,
  Organization context, and generic Location context.
- New modules must define their catalog entry, Tenant entitlement behavior,
  required permissions, and any domain-specific Branch authorization.

## Validation

Validation must cover:

- tenant membership and automatic Tenant establishment during authentication;
- denial when `tenant_modules` does not entitle the requested module;
- denial when the user lacks the required permission;
- Branch authorization for branch-aware operations;
- tenant isolation through PostgreSQL RLS;
- frontend visibility not bypassing backend authorization.

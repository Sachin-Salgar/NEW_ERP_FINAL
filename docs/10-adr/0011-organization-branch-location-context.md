# ADR-0011: Organization, Branch, and Location Context Model

**Date**: 2026-09-01  
**Status**: Approved  
**Approval Date**: 2026-09-01  
**Approved By**: Project Owner  
**Scope**: Core enterprise context, business hierarchy, operational authorization, transaction scoping

## Context

The ERP must keep tenant identity, business organization identity, and operational working context clearly separated. The current repository evidence shows that the architecture already defines:

- **Tenant** as the security and RLS boundary.
- **Organization** as the legal/business entity and the primary business identity within the tenant.
- **Branch** as the operational business unit inside an organization.
- **Location** as the physical site or plant/warehouse context inside an organization.

The implementation must not silently conflate these concepts. A single authoritative hierarchy must apply across backend validation, database constraints, UI workflow, and RBAC/session context.

## Decision

The ERP uses the following canonical model:

```text
Tenant
  └── Organization
       ├── Branch (operational business unit)
       └── Location (physical site / warehouse / plant)
```

This is the authoritative interpretation for the current ERP:

- An Organization is the legal and business entity within a tenant.
- A Branch is an operational business unit belonging to an Organization.
- A Location is a physical operating site or site-level context within an Organization.
- Branch and Location are distinct operational dimensions and are not interchangeable.
- Branch and Location are siblings under Organization; neither is a child of the other.
- An Organization may have multiple Branches.
- An Organization may have multiple Locations.
- A Location does not exist as a stand-alone root record without an Organization.
- A Branch must belong to exactly one Organization.

### Current implemented state

The repository implements the working context as the four-part context tuple:

```text
tenantId
organizationId
branchId
locationId
```

This is the active working context used by the authenticated session and backend-validated authorization flow. The backend is authoritative for the effective values. The client updates its session/context only after backend validation succeeds. Failed context switches preserve the previous valid context.

The persisted user defaults in the current schema are:

- `users.organization_id` → default Organization
- `users.default_branch_id` → default Branch
- `users.default_location_id` → default Location

There is no `users.default_organization_id` field; `users.organization_id` already serves as the default Organization for the user and the effective organization context.

## Ownership Matrix

| Concern | Organization | Branch | Location |
| --- | --- | --- | --- |
| Statutory identity | Yes | No | No |
| Tax registration | Yes | Conditional / inherited in local operational context | Conditional / site-level only |
| Legal address | Yes | No | No |
| Operational address | No | Yes | Yes |
| Warehouse / site details | No | Conditional | Yes |
| Business configuration | Yes | Override when needed | Override when needed |
| Contact information | Yes | Yes | Yes |
| Transaction operating context | Yes | Yes | Optional, if domain requires site context |

Where the ERP wants site-specific data, Location is the correct owner. Where the ERP needs a business unit operational scope, Branch is the correct owner. The business/legal identity remains at Organization.

## Code Generation Policy

Organization and Branch codes are server-generated and immutable after creation. Client-provided values are ignored on create requests and do not become the authoritative code. The database enforces uniqueness at the applicable tenant-scoped key, and the backend rejects manual code changes after creation.

The existing repository evidence uses the following pattern:

- Organization code: `ORG000001`
- Branch code: `BR001`

The exact numeric width is a repository implementation detail, but the format is fixed, generated server-side, and not client-authoritative.

## Session and Authorization Context

Operational business logic and transactions resolve the effective working context from the authenticated session and backend-validated organization/branch/location access:

```text
Authenticated User
  ↓
Tenant-scoped session
  ↓
Authorized Organization context
  ↓
Authorized Branch context
  ↓
Authorized Location context
  ↓
Business operation
  ↓
PostgreSQL RLS
```

The effective working context is the complete tuple `tenantId + organizationId + branchId + locationId`. The backend checks tenant membership, organization membership, branch authorization, and location authorization before the context becomes active. Client-provided tenant or context identifiers are never accepted as the security boundary. Organization selection changes which Branch and Location values are valid; Branch and Location must both belong to the selected Organization. Invalid combinations cannot become the active context.

## Consequences

### Positive

- The model resolves the legal/business identity boundary clearly.
- Operational transaction scopes remain explicit and auditable.
- Branch and Location remain distinct without creating redundant architectural layers.
- Backend, database, RBAC, and UI use a shared hierarchy contract.
- PostgreSQL RLS remains the enforcement boundary without client-supplied tenant or organization control.

### Negative

- Some domain records need explicit `organization_id` / `branch_id` ownership decisions rather than a one-size-fits-all pattern.
- The code generation policy removes client-side manual code entry, requiring all create screens and APIs to rely on backend-generated identifiers.

## Related Documents

- `docs/03-database/12-organizational-isolation.md`
- `docs/10-adr/0006-identity-based-tenant-context.md`
- `docs/10-adr/0010-organization-module-access.md`

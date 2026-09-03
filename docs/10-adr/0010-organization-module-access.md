# ADR-0010 — Organization Module Access Boundary

- **Status:** Approved
- **Date:** 2026-08-26
- **Decision:** Separate tenant module entitlement from organization module enablement and combine both with effective user permissions for runtime access.

## Context

The ERP architecture requires module access to be controlled independently from RBAC permissions. A role may grant a permission, but that permission must not make a disabled organization module accessible.

The existing database already contains `tenant_modules`, which represents tenant-level module entitlement. The missing boundary was organization-specific module enablement.

## Decision

Introduce `organization_modules` as the organization-level enablement boundary.

Runtime access requires all three conditions:

1. the module is entitled/enabled for the tenant;
2. the module is enabled for the active organization;
3. the authenticated user has the required permission.

The backend enforces this through the shared authorization middleware. Frontend module visibility is a UX representation of the same effective access state and is never a security boundary.

Core platform modules are enabled automatically for new tenants and organizations and cannot be disabled through the module management API.

## Context sequencing

Operational authorization must not be evaluated against an organization or location that the user has not explicitly established.

The login flow therefore establishes context in this order:

`tenant → authentication → organization → location → modules → permissions → dashboard`

When multiple organizations are available, the initial authenticated session has no active organization. Selecting an organization creates a new server-authoritative session. Location resolution is blocked until that organization context exists.

## Consequences

### Positive

- Module entitlement and RBAC remain separate concerns.
- Organization-specific module enablement is data-driven.
- Disabled modules cannot be reached merely because a role contains the permission.
- PostgreSQL RLS can scope `organization_modules` to tenant and active organization context.
- The same effective module state can drive navigation without making the client authoritative.

### Trade-offs

- A module access check adds a database lookup to protected permission checks.
- Module configuration requires both tenant entitlement and organization configuration.
- New business modules must define their module registry entry and tenant/org enablement policy.

## Validation

The E2E fixture and integration test verify:

- tenant resolution before login;
- explicit organization selection;
- explicit location selection;
- module discovery;
- denial of a protected RBAC route when its organization module is disabled;
- restoration after re-enabling the module;
- tenant mismatch rejection;
- limited-user permission denial.

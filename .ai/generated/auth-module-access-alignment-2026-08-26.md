# AUTH / CORE-01 Alignment Evidence — 2026-08-26

This generated implementation record supersedes stale status notes for the authentication-context slice after the Phase 1–4 alignment work on this branch. The canonical architecture remains governed by `.ai/authority.md` and the approved ADRs.

## Implemented

- Tenant bootstrap remains the pre-login tenant context boundary.
- Multi-organization login now establishes an authenticated session without an active organization when explicit selection is required.
- Organization selection creates a new organization-scoped session.
- Location resolution is blocked until an active organization exists.
- Multiple authorized locations require explicit location selection.
- Location selection creates a new organization + location scoped session.
- Tenant module entitlement is represented by `tenant_modules`.
- Organization module enablement is represented by `organization_modules`.
- Backend permission middleware checks module enablement before evaluating the permission.
- Frontend loads module state after organization context exists and filters navigation by module + permission.
- Core modules are automatically enabled for tenants and organizations and cannot be disabled through the module API.

## E2E validation target

`tenant bootstrap → login → organization selection → location selection → module discovery → module disable/deny → module enable/restore → tenant mismatch rejection → limited-user permission rejection`

## Documentation reconciliation

- `docs/04-backend/08-authentication-context-and-module-access-implementation.md` records the implemented runtime flow.
- `docs/10-adr/0010-organization-module-access.md` records the module entitlement/organization enablement decision.

The implementation roadmap must record the corresponding CORE-01 completion evidence after the CI run for this branch is green. This file is an evidence artifact, not a replacement for the canonical roadmap.

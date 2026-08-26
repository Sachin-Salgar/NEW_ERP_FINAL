# ADR-0010 — Login Context and Organization Module Access

**Status:** Implemented / validation in CI
**Date:** 2026-08-26
**Scope:** Authentication context sequencing and organization module enablement

## Context

The authoritative security architecture defines the effective request context as tenant → organization → location, followed by authorization and business-module access. The backend database model already contains `modules` and `tenant_modules`, and the authentication documentation requires a module to be both enabled/licensed for the organization and authorized for the user.

The previous implementation had two gaps:

1. A user with multiple organization memberships could receive a login session carrying the user's stored organization, while the organization-membership API correctly required an explicit selection.
2. Permission evaluation did not consult `tenant_modules`, so a user could retain a permission for a module that the organization had disabled.

## Decision

1. Authentication resolves organization memberships when establishing the initial session.
2. If multiple organizations are available, the initial session has no active organization. The organization-selection endpoint creates the organization-scoped session.
3. Location access is unavailable until an organization context exists. Location selection creates a server-authoritative organization + location session.
4. Permission middleware evaluates both user authorization and organization module enablement.
5. Effective frontend permissions are returned from the same module-aware authorization path so disabled modules disappear from client authorization state as well as backend access.
6. The existing `modules` and `tenant_modules` schema is reused; no new licensing model or speculative business-module model is introduced.

## Resulting flow

```text
Trusted tenant resolution
        ↓
Authentication
        ↓
Organization membership resolution
        ↓
Organization selection (when required)
        ↓
Location resolution / selection
        ↓
Effective authorization
        ↓
Organization module enabled?
        ↓ yes
User permission granted?
        ↓ yes
Dashboard / module access
```

## Security rule

A permission grant is not sufficient by itself. Access is allowed only when the corresponding organization module is explicitly enabled and the user has the required role/direct permission.

## Validation

The implementation is covered by:

- DB-backed authorization integration coverage for module disable/restore behavior.
- DB-backed organization → location sequencing coverage.
- Flutter web E2E coverage for effective module/permission state after login.
- CI `CI - Integration Tests (Postgres)` validation.

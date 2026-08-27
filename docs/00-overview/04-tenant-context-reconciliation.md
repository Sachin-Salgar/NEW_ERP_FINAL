# Tenant Context Reconciliation — Current Implementation Contract

**Status:** ACTIVE
**Date:** 2026-08-27
**Authority:** This document supplements `03-implementation-roadmap.md` with the current tenant/context architecture while preserving the roadmap's historical implementation ledger and frontend/backend detail.

## Why this document exists

The original implementation roadmap contains the full CORE/AUTH implementation sequence and historical evidence. It must not be replaced by a shortened migration summary. This reconciliation records the architectural change that supersedes stale tenant-selection UX and host/deployment tenant resolution without deleting the existing roadmap detail.

## Canonical flow

```text
Client
  |
  | configured ERP API URL
  v
ERP Backend
  |
  | login identifier + password
  v
Deployment-independent login identity lookup
  |
  v
Authenticated tenant-scoped user
  |
  v
Tenant-scoped session / TenantContext
  |
  +--> configured default organisation (when available)
  |
  +--> configured default location (when available)
  |
  v
Dashboard
  |
  +--> Profile / Working Context menu
         |
         +--> switch organisation
         |
         +--> switch location within active organisation
```

## UX contract

1. Login must never display an organisation-selection screen.
2. Login must never display a location-selection screen.
3. Successful authentication navigates directly to Dashboard.
4. The tenant is established from authenticated identity and is not a user-selectable working context.
5. A user's default organisation is applied automatically when configured and authorized.
6. A user's default location is applied automatically when configured, authorized, and compatible with the active organisation.
7. Missing organisation/location defaults do not block authentication or Dashboard access.
8. Organisation and location are working-context controls exposed through the authenticated Profile / Working Context menu.
9. Changing organisation reloads valid locations, accessible modules, and effective permissions for that organisation.
10. A location may only be selected when it belongs to the active organisation and the user is authorized for it.
11. Working-context changes cannot change `tenant_id`.

## Deployment contract

### SaaS

The frontend uses the central ERP API endpoint. The user logs in normally; identity lookup discovers the tenant account. No tenant hostname or tenant selection is required in the login UX.

### On-premises

The installed web frontend and mobile client are configured with the customer's ERP backend API URL. The URL identifies the backend installation, not the tenant. Authentication still establishes tenant identity from the user's login account.

### Mobile

Mobile connects to the configured ERP backend API. It never connects directly to PostgreSQL and does not derive tenant authority from a client-supplied tenant identifier.

## Security boundary

- Client/API URL: connectivity only.
- Login identity: candidate tenant discovery.
- Validated authenticated session: tenant authority.
- Backend authorization: authoritative application boundary.
- PostgreSQL transaction tenant context + RLS: final database isolation boundary.
- Organisation/location: subordinate working context inside the established tenant.

## Stale architecture that must not be reintroduced

The following are retired from the active architecture:

- host/domain/Vercel URL as tenant authority;
- deployment-specific tenant resolver strategies as runtime tenant authority;
- client-authoritative tenant headers;
- standalone organisation selection at login;
- standalone location selection at login;
- routing users to a selection screen merely because a default working context is missing.

Historical roadmap entries describing these earlier implementation steps remain valuable evidence and are not to be rewritten as if they never existed. New implementation work must follow this reconciliation contract.

## E2E fixture requirement

The deterministic Postgres E2E fixture creates users after migrations have already executed. Therefore it must explicitly create the corresponding rows in `auth_login_identifiers` for email and username identities. Production migration backfill is not sufficient for users created later by the fixture.

The fixture must also provide the authorized organisation/location relationships required to validate the post-login working-context flow.

## Roadmap relationship

`03-implementation-roadmap.md` remains the complete living implementation roadmap, including frontend/backend work, validation history, and business-module sequencing. This document is the current architecture/UX reconciliation that must be applied when interpreting any stale historical roadmap entry.

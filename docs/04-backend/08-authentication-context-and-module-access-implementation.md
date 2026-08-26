# Authentication Context and Module Access — Implemented Flow

**Status:** Implemented on `feature/auth-module-access-alignment` and pending CI validation.

## Authoritative runtime sequence

The implemented post-login flow is:

1. Resolve tenant from the trusted deployment host during `/bootstrap`.
2. Authenticate credentials against the resolved tenant.
3. Resolve the user's organization memberships.
4. If more than one organization is available, issue a session with no active organization and require explicit organization selection.
5. Selecting an organization creates a new server-authoritative session scoped to that organization.
6. Only after an active organization exists can locations be resolved.
7. If multiple authorized locations exist, require explicit location selection.
8. Selecting a location creates a new server-authoritative session scoped to organization + location.
9. Resolve enabled organization modules.
10. Resolve effective user permissions.
11. Present the dashboard/navigation using the intersection of enabled modules and effective permissions.
12. Backend authorization remains authoritative for every protected route.

## Module access model

Module access is evaluated as:

`tenant entitlement` + `organization enablement` + `user permission`

- `tenant_modules` is the tenant/subscription entitlement boundary.
- `organization_modules` is the organization-level enable/disable boundary.
- `role_permissions` / effective permissions are the user authorization boundary.
- A protected route must satisfy both module enablement and permission authorization.

Core modules are automatically enabled for newly-created tenants and organizations. Core modules cannot be disabled through the module management API.

## API surface

- `GET /api/v1/auth/modules` — returns modules enabled for the active organization and entitled for the tenant.
- `POST /api/v1/auth/modules/:code/enable` — enables an organization module; requires `tenant.manage`.
- `POST /api/v1/auth/modules/:code/disable` — disables a non-core organization module; requires `tenant.manage`.

Protected permission checks also enforce the corresponding module boundary before evaluating the permission itself.

## Frontend behavior

`AuthService` keeps organization, location, module, and permission state separately.

- Organization selection blocks operational context resolution until an organization is selected.
- Location selection is required only when more than one authorized location exists and no active location has been established.
- Module state is loaded only after an active organization exists.
- Navigation hides entries when either the required module is disabled or the effective permission is absent.
- The backend remains the security boundary; frontend checks are UX only.

## E2E coverage

The integration E2E now exercises:

`tenant bootstrap → login → organization selection → location selection → dashboard → module listing → module disable → permission route denied → module re-enable → permission route restored → tenant mismatch rejected → limited-user permission denied`

The deterministic fixture contains two organizations and two locations for the admin user so the selection stages are exercised rather than bypassed.

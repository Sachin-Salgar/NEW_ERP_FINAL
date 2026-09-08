# Authentication Context and Module Access — Implemented Flow

**Status:** Historical implementation note; reconciled with approved ADR-0040 and the current one-login flow.

## Authoritative runtime sequence

The current post-login flow is:

1. Authenticate the identifier using the deployment-independent identity lookup.
2. Resolve the authenticated identity's validated tenant membership and establish a tenant session, or establish a platform session from platform membership.
3. Apply configured tenant working-context defaults when valid.
4. Go directly to Dashboard; organization, branch, and location selection never gates login.
5. Allow authorized working-context changes from the authenticated profile menu.
6. Resolve enabled organization modules and effective user permissions.
7. Present dashboard/navigation using the intersection of enabled modules and effective permissions.
8. Backend authorization remains authoritative for every protected route.

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
- `POST /api/v1/auth/modules/:code/enable` — enables an organization module; requires `tenant.update`.
- `POST /api/v1/auth/modules/:code/disable` — disables a non-core organization module; requires `tenant.update`.

Protected permission checks also enforce the corresponding module boundary before evaluating the permission itself.

## Frontend behavior

`AuthService` keeps organization, location, module, and permission state separately.

- Missing working-context defaults do not block login.
- Organization, branch, and location selection is a post-login action.
- Module state is loaded for the active organization when one is available.
- Navigation hides entries when either the required module is disabled or the effective permission is absent.
- The backend remains the security boundary; frontend checks are UX only.

## E2E coverage

The integration E2E now exercises:

`tenant bootstrap → login → dashboard → working-context switch → module listing → module disable → permission route denied → module re-enable → permission route restored → tenant mismatch rejected → limited-user permission denied`

The deterministic fixture contains two organizations and two locations for the admin user so post-login working-context switching can be exercised.

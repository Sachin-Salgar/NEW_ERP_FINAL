# Authentication Context and Module Access

**Status:** Current implementation guidance

## Authentication flow

The backend authenticates the submitted identity and establishes the user's single
tenant context from the validated tenant membership:

1. Resolve the login identifier.
2. Verify the active credential.
3. Resolve the user's tenant account.
4. Create a tenant-scoped session.
5. Load tenant permissions and enabled modules.
6. Authorize the requested operation.

Normal login does not include tenant selection. Tenant switching and multi-tenant
application-user context selection are not supported. Platform administration uses a
separate platform session and permission domain.

## Module access model

Module access is evaluated as:

`tenant entitlement` + `user permission`

- `tenant_modules` is the tenant-level module entitlement boundary.
- Role and effective-permission records are the user authorization boundary.
- A protected route must satisfy both module enablement and permission authorization.

Core modules are enabled for a tenant according to the tenant provisioning rules.
Core modules cannot be disabled through the module management API.

## API surface

- `GET /api/v1/auth/modules` returns modules enabled for the authenticated tenant.
- `POST /api/v1/auth/modules/:code/enable` enables a tenant module when authorized.
- `POST /api/v1/auth/modules/:code/disable` disables a non-core tenant module when
  authorized.

Protected permission checks enforce the module boundary before evaluating the
permission itself.

## Frontend behavior

The frontend may keep tenant, branch, module, and permission state for presentation
and navigation. Frontend state is never authoritative.

- Missing branch context does not change the authenticated tenant.
- Branch selection is a post-login business action only where a domain requires it.
- Navigation hides entries when the required module is disabled or permission is absent.
- The backend remains the security boundary for every protected route.

## Cross references

- [Authentication and Authorization](./07-authentication-and-authorization.md)
- [Multi-Tenant Architecture](../03-database/11-multi-tenancy.md)
- [Platform, Tenant, and Branch Architecture](../10-adr/0040-platform-identity-membership-and-context.md)

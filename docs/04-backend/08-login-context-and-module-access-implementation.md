# Login Context and Module Access — Implementation

**Status:** Implemented / CI validation in progress
**Authority:** Implementation detail aligned with `docs/06-security/04-enterprise-security-architecture.md` and `docs/04-backend/07-authentication-and-authorization.md`

## Implemented sequence

The backend now establishes the authenticated context in this order:

1. Tenant is resolved from the trusted deployment host.
2. Credentials are authenticated inside that tenant.
3. Organization memberships are resolved.
4. A user with multiple memberships receives an authenticated session without an active organization.
5. Organization selection creates a new server-authoritative organization-scoped session.
6. Location queries require an active organization; no locations are exposed before organization context exists.
7. Location selection creates the server-authoritative organization + location session.
8. Effective permissions are evaluated only after authentication context exists.
9. Permission evaluation requires both organization module enablement and user authorization.

## Module access

The existing database model is used:

- `modules` — platform module catalog.
- `tenant_modules` — tenant-level module enablement state.
- `permissions.module_code` — associates permissions with modules.
- `role_permissions` / `user_permissions` — user authorization sources.

Effective access is therefore:

```text
Tenant module enabled
        AND
User has effective permission
        ↓
      ALLOW
```

A disabled organization module causes both backend permission middleware and frontend effective-permission state to deny/hide the associated module.

## Frontend contract

`GET /api/v1/auth/effective-permissions` returns:

- effective permission keys;
- effective authorized modules.

The Flutter `AuthZService` consumes this endpoint. Client-side route/menu checks remain UX controls; backend middleware remains authoritative.

## Validation coverage

- `tests/integration/authorization-flow.test.ts` verifies module disable → 403 and permission removal from effective authorization state, then restore → 200.
- `tests/integration/login-context-flow.test.ts` verifies login → organization selection → location access → active location session.
- `frontend/integration_test/login_tenant_auth_e2e_test.dart` verifies tenant bootstrap, dashboard login, effective module state, tenant mismatch rejection, and limited-user authorization.

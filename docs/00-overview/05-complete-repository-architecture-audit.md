# Complete Repository Architecture and Identity Audit

**Date:** 2026-09-08  
**Scope:** Repository architecture, `.ai` agent context, authentication and identity, tenant/platform context, authorization, PostgreSQL/RLS, Flutter parity, seed data, deployment, and validation.

## Executive summary

**Overall status: YELLOW**

The repository has a substantial and generally well-tested Core Enterprise implementation, including PostgreSQL RLS, tenant authorization, a platform authorization middleware, deterministic migrations, and Flutter admin surfaces. It is aligned on the validated local authentication path, with remaining operational and platform-UX gaps:

1. There is no repository deployment manifest or release step that runs migrations, security/bootstrap, and the custom tenant seed in an ordered, controlled deployment flow.
2. Platform login/context switching has backend support but no complete corresponding frontend flow.
3. ADR-0040's one-identity membership discovery and explicit tenant/platform context selection are not wired into the primary login endpoint; tenant login and platform login remain separate flows.
4. The custom seed's dedicated clean/repeat/login validation is now executed locally against the configured PostgreSQL test database. The prior local failure was configuration-related: integration setup used application `DATABASE_URL` as its administrative connection, while `.env.local` correctly supplied a separate `TEST_DATABASE_URL` and local `PG*` administrative credentials.

These are implementation, context, and operational gaps rather than a reason to redesign the approved architecture.

## Authority and conflicts

### Authoritative documents consulted

- `docs/README.md`
- `docs/00-overview/02-governance.md`
- `docs/00-overview/03-implementation-roadmap.md`
- `docs/02-architecture/*`
- `docs/03-database/11-multi-tenancy.md`
- `docs/03-database/16-security-architecture.md`
- `docs/04-backend/07-authentication-and-authorization.md`
- `docs/04-backend/08-authentication-context-and-module-access-implementation.md`
- `docs/05-frontend/*` (frontend, API, state, routing, and testing guidance)
- `docs/06-security/*`
- `docs/07-devops/*`
- `docs/10-adr/0006-identity-based-tenant-context.md`
- `docs/10-adr/0011-organization-branch-location-context.md`
- `docs/10-adr/0012-branch-access-representation.md`
- `docs/10-adr/0021-jwt-key-rotation-jwks.md`
- `docs/10-adr/0040-platform-identity-membership-and-context.md`

### DOCUMENTATION_CONFLICT

ADR-0040 is approved and later than ADR-0006. It supersedes the tenant-only identity/session model within its stated scope and requires one identity with independent tenant and platform memberships. It also requires login to return memberships without granting context, followed by explicit server-validated context selection (with a single active tenant membership eligible for a safe default). The current implementation still creates a tenant session directly from `/auth/login` and exposes a separate `/auth/platform-login`; this is an implementation gap, not an alternate interpretation of ADR-0040.

## ADR-0040 focused identity/context proof

### Requirements used as acceptance criteria

- One globally unique identity owns the credential and may have independent tenant and platform memberships.
- Tenant membership is the authority for tenant context; platform membership is the authority for platform context.
- Tenant and platform roles are separate permission domains.
- One credential login resolves the identity and returns active membership metadata before granting context.
- A sole active tenant membership may be safely defaulted; multiple memberships require explicit context selection.
- Platform context is never inferred from tenant membership and requires explicit server-validated selection.
- Context selection creates a context-bound session and tokens; authorization derives context from the validated session, not client tenant IDs.
- Tenant APIs use tenant session/membership authorization and RLS; platform APIs use platform session/membership/permission checks and the dedicated platform procedure boundary.
- After a tenant context is established, the tenant client lands on Dashboard. Platform landing is the platform administration surface only after a valid platform context exists.

### Platform administrator provisioning and data proof

The first platform administrator is **not** created by a migration, `seed-custom-tenant.ts`,
application startup, or HTTP endpoint. The operational path is:

```text
npm exec tsx scripts/platform-admin.ts bootstrap <email>
  → identities + identity_credentials
  → auth_login_identifiers
  → platform_memberships
  → platform_owner role assignment
  → platform audit event
```

The command requires operator-provided bootstrap secret and password environment values,
uses an advisory lock and one-time state, and refuses a second active platform bootstrap.
`recover` is a separate operator action. The custom tenant seed creates tenant projections,
tenant memberships, users, roles, and credentials; it does **not** create a platform
administrator. A platform administrator may also have tenant memberships because the
identity and membership domains are independent, but the current seed/test fixtures do
not prove that combined case.

The platform-only backend path is proven separately by `zero-state-platform-acceptance`:
bootstrap CLI → `/auth/platform-login` → platform JWT/session → `requirePlatformContext`
→ platform membership/permission validation → platform API authorization. The platform
path does not require a tenant membership. Platform APIs reject tenant-context tokens,
and tenant business APIs reject platform-context tokens in the acceptance test.

### Actual login/context implementation versus ADR

| Scenario | Login UI | Identity resolved | Memberships discovered | Context resolved | Redirect | Authorization | Status |
|---|---|---|---|---|---|---|---|
| Tenant User | Same login screen → `/auth/login` | Tenant account lookup resolves identity through legacy tenant candidates | Tenant account only; no identity-wide membership response | Tenant session is created directly; org/branch/location defaults load afterward | `/dashboard` | Tenant `requireAuth`, permissions, and RLS | **PARTIALLY VERIFIED** |
| Tenant Admin | Same login screen → `/auth/login` | Same tenant account path | Tenant account only | Tenant session direct; working context can switch post-login | `/dashboard` | Tenant RBAC and RLS tested | **PARTIALLY VERIFIED** |
| Multi-Tenant User | Same login screen exists | **NOT VERIFIED** as one global identity; current service iterates tenant candidates and fails on multiple valid matches | **NOT IMPLEMENTED** as ADR membership discovery response | No tenant/platform context chooser in primary login flow | No proven selection redirect | No proven selected-membership session | **NOT IMPLEMENTED** |
| Platform Admin | Login screen does not call platform login; backend exposes separate `/auth/platform-login` | Platform endpoint resolves identity and active platform membership | Platform membership is queried only by that endpoint | Platform session is created directly by platform login or `/auth/context` | Frontend does not select `/platform`; backend platform authorization is proven separately | `requirePlatformContext` plus platform role/permission checks | **PARTIALLY VERIFIED** |
| Platform + Tenant | No unified UI path | Independent memberships exist in schema, but combined login discovery is not exposed | **NOT IMPLEMENTED** in primary login response | No explicit platform-vs-tenant context choice in frontend | No proven context-specific redirect | Separate backend contexts work independently; combined case is unproven | **NOT VERIFIED** |

### Frontend trace

The actual client chain is:

```text
LoginScreen._submit
 → AuthService.login
 → POST /auth/login
 → _storeSession(tenant session)
 → load organization/branch/location/modules/permissions
 → /dashboard
```

`ApiClient` adds the stored bearer token to requests. The profile context menu can switch
organization/branch/location through `/auth/context/select`, but that is post-login
working context inside an already-selected tenant and is not ADR-0040 membership context
selection. The `/platform` route and administration screen exist, but no frontend method
calls `/auth/platform-login`, `/auth/context` with `contextType: platform`, or a unified
membership discovery endpoint. Therefore platform UI capability is present without a
complete platform-context acquisition and redirect flow.

### Backend contract proof

`/auth/login` returns a tenant user/session and organization metadata, not identity-wide
tenant/platform membership metadata. `/auth/platform-login` returns a platform token and
platform context but is a separate endpoint. `/auth/context` can create tenant or
platform sessions from an existing token, while `/auth/context/select` only selects
organization/branch/location and is guarded by tenant `requireAuth`. `/auth/me` is also
tenant-only and returns only the sanitized tenant user projection. This is insufficient
for a conforming one-login membership discovery UI.

## Architecture intent → implementation → tests → UI → deployment

| Rule | Intended architecture | Implementation evidence | Test evidence | UI evidence | Deployment evidence | Status |
|---|---|---|---|---|---|---|
| Identity and memberships | One identity; independent tenant and platform memberships; separate permission domains | `identities`, `identity_credentials`, `tenant_memberships`, `platform_memberships`, context-aware sessions, platform middleware | `authentication-flow`, `phase2-platform-security`, zero-state acceptance | One login screen exists; platform page exists | Platform bootstrap CLI exists; no ordered tenant deployment seed | **PARTIAL** |
| Tenant authority | Authenticated server-side membership/session; client tenant IDs never authorize | `requireAuth` derives `request.tenantId` from validated session; tenant-scoped services and RLS | tenant mismatch and RLS tests | Client persists/sends tenant display state, but backend remains authority | API endpoint is deployment configuration only | **PASS with client-context cleanup needed** |
| Platform authority | Platform membership/session and dedicated executor boundary | `requirePlatformContext`, platform permission repository, `platformDbPool`, guarded SQL procedures | platform security and platform/tenant separation tests | `/platform` route and screen | `PLATFORM_DATABASE_URL` required in production | **PASS for tested paths** |
| Database isolation | `erp_app`-like non-bypass role, transaction-local context, RLS/FORCE RLS | migration policies, `withTenantContext`, role bootstrap SQL, repository transaction boundaries | tenant/RLS/role/audit atomicity suites | Not applicable | CI provisions non-superuser RLS role; production role setup is external | **PASS in repository/CI/local test database; production evidence pending** |
| Login UX | One login; membership context is selected after credential verification; organization/branch/location are post-login working context | `/auth/context` validates context, but `/auth/login` grants tenant context directly and `/auth/platform-login` is separate | existing tenant/platform tests cover separate flows, not one-login membership discovery | router supports tenant and platform routes but has no membership-selection flow | no deployment smoke workflow | **PARTIAL** |
| Frontend security | UI visibility is convenience; backend authorizes every operation | route permissions, backend middleware, and bearer propagation | route/authz tests and bearer regression test | permission-aware navigation | frontend/backend split documented | **PASS** |
| Seed | deterministic, idempotent, non-production-safe known tenant/admin/user identities | environment credentials, opt-in, production guard, deterministic script | dedicated three-run clean/repeat/login/admin-operation/platform-denial proof passes locally; seed repairs identity credentials and role assignments idempotently | seeded admin can be used by E2E fixtures | no deployment pre-deploy/release seed | **PARTIAL** |

### Local database verification

`npm run db:diagnose` confirmed that `.env.local` is present and loaded, `DATABASE_URL` reaches `newerp` as `erp_app`, `TEST_DATABASE_URL` reaches `newerp_test` as `newerp_test_runner`, and local PostgreSQL 17 is accepting both connections. The prior `28P01` result was caused by the earlier stale local application credential and incorrect administrative setup path; it is now resolved without exposing the credential. No database or role was created by this audit.

## `.ai` audit

### Consumption chain

The repository has a real instruction chain:

`Copilot repository instructions → `.ai` workflow/authority files → authoritative `docs/` → implementation/tests`

Evidence:

- `.github/copilot-instructions.md`, `AGENTS.md`, and `.github/instructions/*` require `.ai` and `docs/` navigation.
- `.ai/workflows/ai-system.md` defines mandatory session initialization.
- `.ai/workflows/feature-development.md` defines discovery, authority, implementation, validation, and reporting.
- `tools/ai/validate_ai_workflow.py` validates required workflow files and phrases.
- `tools/ai/repository_scanner.py` deterministically generates `.ai/generated/*`.
- `.github/workflows/ai-workflow-validation.yml` runs both validation and scanner generation.

This is a working workflow bridge, not merely a collection of unused files.

### Context coverage matrix

| Context area | Present | Accurate | Agent-usable | Gap |
|---|---:|---:|---:|---|
| Project purpose and layered architecture | Yes | Yes | Yes | Keep generated index navigational |
| Governance and ADR discovery | Yes | Partial | Yes | ADR-0040 precedence is not reflected consistently |
| Platform architecture | Yes | Yes | Yes | Keep capability/UI map current |
| Tenant/identity/authentication | Yes | Yes | Yes | ADR-0040 precedence is explicit |
| Authorization and module boundaries | Partial | Yes | Partial | No compact backend/frontend capability map |
| Request/user/tenant/platform/database context | Partial | Yes | Partial | No end-to-end context propagation map |
| PostgreSQL roles/RLS/procedures | Yes | Yes | Yes | Production role evidence is external |
| Frontend/state/routing/API | Partial | Yes | Yes | Complete platform-context UI remains open |
| Testing and validation | Yes | Partial | Yes | Known browser teardown residual is not surfaced in `.ai` |
| Seed/deployment/environment | Yes | Partial | Yes | Provider release wiring remains open |
| Forbidden patterns and safe-change checklist | Yes | Yes | Yes | Add ADR-0040 and seed-specific checks |
| Current implementation status/known gaps | Yes | Partial | Partial | Roadmap and audits disagree on completion labels |

### New-agent practical answers

Using only the current `.ai` and repository instructions, an agent can answer the system purpose, basic tenant/RLS rules, frontend/backend boundaries, and required workflow. It cannot answer the approved platform membership model, the current post-login no-selection contract, or the safe deployment-seed procedure without reading multiple source documents and resolving conflicts. Therefore `.ai` is **working but incomplete and partially stale**.

## Actual authentication and identity flow

### Tenant login

`frontend/lib/modules/auth/login_screen.dart::_submit`
→ `AuthService.login`
→ `POST /api/v1/auth/login`
→ `AuthenticationService.authenticate`
→ deployment-independent `auth_login_identifiers` candidate lookup
→ tenant-scoped user lookup/password verification
→ session creation with tenant/user/identity/default organization/branch/location
→ JWT access and refresh tokens
→ Flutter secure storage and permission/context loading
→ `GET /api/v1/auth/me` on restore
→ `requireAuth` verifies JWT and session, then derives `request.user` and `request.tenantId`
→ backend permission/module checks
→ dashboard route.

The tenant is server-derived from the matched account/session. A client tenant header is not trusted by `requireAuth`, although the client still sends one and some legacy/pre-auth endpoints inspect headers.

### Platform login

`POST /api/v1/auth/platform-login`
→ global identity/credential lookup
→ active `platform_memberships` lookup
→ platform session with `tenant_id NULL`
→ platform JWT (`contextType: platform`)
→ `requirePlatformContext`
→ platform membership and permission validation
→ platform repository or `platformDbPool` procedure execution.

Platform context is separate from tenant context. Tenant roles do not grant platform authority.

## Context propagation and security

The intended chain is:

`verified token → validated session/membership → request.user/request.tenantId or platform fields → service authorization → transaction-local PostgreSQL settings → RLS/procedure boundary`.

Repository evidence supports this chain for tested backend paths. `withTenantContext` establishes tenant settings on the same connection used for protected work. Platform lifecycle mutations use the dedicated pool when configured and fail closed in production when it is absent. CI tests use non-superuser, `NOBYPASSRLS` roles.

The main confirmed live-client defect is that `frontend/lib/core/network/api_client.dart` assigns a masked literal to the `Authorization` header instead of `Bearer <accessToken>`. This breaks the client-to-backend propagation even though backend tests pass.

## User type matrix

| User type | Login | Identity source | Tenant | Context | Landing | Capabilities |
|---|---|---|---|---|---|---|
| Platform administrator | `/auth/platform-login` | global identity + platform membership | none in platform context | platform membership/session | `/platform` when selected/authorized | platform tenant/member/role/security/audit operations |
| Tenant administrator | `/auth/login` | login identifier → tenant user/identity membership | matched tenant session | default/selected organization, branch, location | `/dashboard` | tenant administration, users, roles, permissions, enabled modules |
| Tenant user | `/auth/login` | same trusted identity/session path | matched tenant session | authorized working context | `/dashboard` | only effective tenant/module permissions |
| Other/unsupported | rejected | no valid active identity/membership | none | none | `/login` | none |

The backend supports a platform context switch endpoint, but the frontend’s context model is primarily tenant-scoped and does not present a complete multi-membership platform/tenant switch UX.

## Backend capability → API → frontend

| Capability | API/backend | Frontend | Classification |
|---|---|---|---|
| Authentication/session/working context | `/auth/login`, `/auth/me`, organization/context routes | login, auth service, profile context menu | **PASS locally**: platform-context UI remains separate |
| Tenant administration | `/platform/tenants`, tenant administration routes | tenant administration screen | **PARTIAL**: platform-vs-tenant context UX needs explicit coverage |
| Platform administration | `/platform/*` | platform administration screen | **PARTIAL**: platform login/context acquisition is not exposed as a complete UI flow |
| Organization/branch/location | core, branch, location routes | corresponding lists/forms and profile context menu | **PASS with routing contract cleanup** |
| RBAC/security | RBAC/security administration APIs | role/permission/security screens | **PASS for implemented Core scope** |
| Customer | customer APIs | customer CRUD screens | **PASS** |
| Procurement | purchase APIs | purchase screen/service | **PARTIAL**: bounded slice |
| Inventory/sales/finance/tax | implemented APIs and services | several screens/services | **PARTIAL**: broader modules remain roadmap work |

## Tenant lifecycle

The backend has tenant bootstrap, administrator, organization/branch/location, user, role, module, RLS, and administration capabilities. The custom seed extends this with two organizations, four branches, locations, three users, role access, and deterministic IDs. Isolation and authorization are tested. The missing vertical slice is deployment-safe operational execution and a documented known-login verification path.

## Custom tenant seed audit

Current `scripts/seed-custom-tenant.ts`:

- uses deterministic tenant, organization, branch, administrator, and role IDs;
- creates/updates the tenant, two organizations, four branches, locations, three users (`administrator`, `admin`, `manager`), roles, permissions, memberships, and defaults;
- is broadly repeatable for its controlled data;
- requires environment-provided passwords;
- has explicit enablement and production safety gates;
- has a dedicated three-run clean/repeat/login/authorization/platform-denial integration test;
- is not wired into a deployment release/pre-deploy command.

This is not safe as a production deployment bootstrap in its current form.

## Deployment seed assessment

The repository has a backend Dockerfile, Vercel frontend configuration, GitHub CI/release workflows, migration tooling, and production `PLATFORM_DATABASE_URL` enforcement. It does not contain `render.yaml`, a backend deployment manifest, or an ordered deployment command that performs:

`migrations → security/bootstrap → deterministic tenant seed → application startup`.

The safe architecture is an explicit one-shot/release command (or provider pre-deploy command) guarded by environment variables and an opt-in flag, using secret-provided passwords and refusing production unless explicitly enabled. The script now enforces these credential and safety checks, but it must still be wired to a provider release step. It must not run on every application startup.

## Significant findings

| Severity | Finding |
|---|---|
| **HIGH** | No ordered deployment seed/bootstrap workflow exists for the known-login requirement. |
| **MEDIUM** | Platform login/context switching has backend support but no complete corresponding frontend flow. |
| **MEDIUM** | Custom seed validation is proven locally, but no provider deployment release/pre-deploy execution is wired. |
| **MEDIUM** | Frontend/backend capability matrix and vertical-slice status are not maintained as a concise agent-facing map. |
| **LOW** | Existing browser navigation teardown residual remains documented as a validation gap. |
| **INFORMATIONAL** | Production TLS, key rotation, worker supervision, backup restoration, and provider runtime evidence remain deployment-only. |

## Changes required

1. Add a deployment-safe release/pre-deploy command contract without placing the seed in application startup.
2. Add dedicated clean/repeat/login seed validation where the existing database harness supports it.
3. Complete the platform login/context switching frontend flow if that capability is in current scope.

## Remaining risks after these changes

External penetration testing, provider-specific deployment evidence, production secret rotation, backup restoration, worker supervision, and the broader Flutter browser navigation matrix remain operational/validation work and are not proven by repository-local tests alone.

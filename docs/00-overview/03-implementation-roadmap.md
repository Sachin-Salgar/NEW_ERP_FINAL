# Implementation Roadmap

**Status:** Living implementation roadmap  
**Authority:** Architecture documents and Approved ADRs define the intended system; this document records what is actually implemented and what remains to be validated or built.

**Last reconciled:** 2026-09-01  
**Branch:** `main`

## Status definitions

- **COMPLETED** — implementation exists and repository/CI evidence supports completion for the stated scope.
- **IMPLEMENTED — VALIDATION PENDING** — implementation exists, but required end-to-end, security, or operational validation remains.
- **PARTIAL** — meaningful implementation exists, but material capability remains incomplete.
- **PENDING** — not implemented in the current repository.
- **BLOCKED** — validation/implementation is currently blocked by a known issue.
- **DEFERRED** — intentionally outside the current sequence.

## 1. Architecture baseline

The system is a **layered modular monolith** with Flutter clients, REST API, backend services, repositories/data access, and PostgreSQL.

Tenant identity follows **ADR-0006: Identity-Based Tenant Context and PostgreSQL RLS**. The authenticated user identity is the tenant-discovery authority. Deployment hostname, frontend URL, client-supplied tenant ID, and deployment configuration are not tenant authorities.

PostgreSQL RLS remains the database isolation boundary, with trusted server-side tenant context established transaction-locally.

The old host/deployment **TenantResolver is retired** and is not a current implementation target.

## 2. Current checkpoint

**Current phase:** Core Enterprise foundation implemented; canonical frontend navigation/routing and identity-based authentication/tenant validation have been merged to `main`. The repository now has successful GitHub Actions validation of the deterministic Postgres-backed backend plus the admin and limited-user Flutter Web E2E login/dashboard flows. The remaining release gate is the broader browser navigation matrix, security audit, and final Core Enterprise audit.

### Validation evidence captured

- `npx vitest run tests/integration/authentication-flow.test.ts tests/integration/rbac-role-permissions.test.ts --reporter=basic` → exit code 0 on the current `main` branch.
- GitHub Actions run **33486274877**, workflow `CI - Integration Tests (Postgres)`, commit `8dd4d17edd3f050a66c1bd2c25e47597fda21a95` → **success**.
- The successful CI run completed the Postgres setup/migration/fixture/backend startup path and both Flutter Web E2E steps: **Run admin E2E test → success** and **Run limited-user E2E test → success**.
- This CI run validates the repository-controlled test environment; it does not use or depend on Vercel/Render production deployment configuration.
- Remaining unresolved browser validation item: the broader authenticated browser navigation matrix (deep-link, back/forward, refresh/session restoration, responsive widths, shell persistence) is not fully evidenced by the current CI E2E scenarios.

### Implemented

- Production Flutter Web login against deployed backend/database.
- Identity-based tenant discovery and tenant-scoped authentication/session context.
- TenantContext and PostgreSQL transaction-local tenant context infrastructure.
- PostgreSQL RLS integration coverage for tenant isolation/rollback/pool context behavior.
- Organization, branch/location, and user administration backend/API surfaces.
- Server-generated immutable Organization and Branch codes with explicit branch/location hierarchy validation.
- Organization → Branch → Location working context is implemented as the canonical active context tuple: `tenantId`, `organizationId`, `branchId`, `locationId`.
- User defaults are persisted as `users.organization_id`, `users.default_branch_id`, and `users.default_location_id` with no separate `default_organization_id` field.
- Branch and Location are implemented as sibling operational contexts under Organization; neither is a child of the other.
- Flutter organization, branch, user, role, permission, dashboard, and authentication surfaces.
- Backend RBAC and permission enforcement.
- Flutter permission state, permission-aware navigation and route guards.
- Module enablement enforcement.
- Responsive admin UI foundation based on the adopted upstream responsive admin template direction.
- Poppins typography and Material 3-based theme foundation.
- Project-wide light/dark theme switching.
- Persistent authenticated application shell with responsive sidebar/top bar.
- Canonical Flutter Web Router 2.0 navigation implementation with shared route metadata, persistent content navigation, authorization-aware route gates, and controlled not-found handling.
- Deterministic Postgres-backed CI environment for backend integration and Flutter Web E2E login/dashboard validation.
- Customer foundation and HTTP API vertical slice, including tenant-scoped persistence, RLS, authorization, soft delete, audit, pagination, validation, and dedicated API integration coverage.
- Customer Flutter frontend vertical slice, including CRM navigation, permission/module-aware routing, authenticated CRUD screens, server-side search/pagination, soft-delete confirmation, and focused service/routing tests.

### Not yet complete

- Broader browser E2E verification of authenticated navigation/routing, including deep-link, back/forward, refresh/session restoration, and responsive browser matrix.
- Final security audit.
- Final Core Enterprise completion audit.
- Full business-module implementation.

## 3. Tenancy, identity and authentication

| Area | Status | Current implementation / remaining work |
|---|---|---|
| Tenant data boundary | **COMPLETED** | Tenant-scoped model and PostgreSQL RLS architecture implemented. |
| Identity-based tenant discovery | **IMPLEMENTED — VALIDATION PENDING** | Authentication resolves tenant from authenticated user identity and fails closed on ambiguous active matches. |
| Tenant-scoped session | **IMPLEMENTED — VALIDATION PENDING** | Session carries tenant/user/organization/location context and token lifecycle. |
| TenantContext | **IMPLEMENTED — VALIDATION PENDING** | Server derives tenant from authenticated session; DB helper establishes transaction-local context. |
| PostgreSQL RLS | **COMPLETED** | Integration coverage proves tested tenant visibility/write isolation, rollback and pooled-connection context isolation. |
| Legacy host/deployment TenantResolver | **DEFERRED / RETIRED** | Replaced by identity-based tenant discovery; do not reintroduce it. |
| Login/session frontend | **IMPLEMENTED — VALIDATION PENDING** | Flutter authentication/session restoration exists; CI now proves admin and limited-user browser login/dashboard flows. Full browser navigation/session-restoration matrix remains. |
| Cross-deployment tenancy verification | **PENDING** | Deployment-independent architecture exists, but required representative cross-deployment verification is not yet evidenced. |
| Ambiguous multi-tenant credential handling | **IMPLEMENTED** | Fail-closed behavior is covered by tests. |

## 4. Core Enterprise

| Capability | Status | Evidence / remaining work |
|---|---|---|
| Authentication | **IMPLEMENTED — VALIDATION PENDING** | Backend authentication, Flutter login and token/session handling exist; admin and limited-user browser E2E now pass in CI. |
| Session management / refresh / logout | **IMPLEMENTED — VALIDATION PENDING** | Lifecycle implementation exists; broader browser refresh/session-restoration evidence remains. |
| Organization selection | **COMPLETED** | Backend access/select flow, default user context, and Flutter working-context UI are implemented and validated in scope. |
| Branch selection | **COMPLETED** | Branch belongs to the active Organization; branch defaults and switching are validated in backend and UI flow. |
| Location selection | **COMPLETED** | Location belongs to the active Organization; persisted default location and selection validation are implemented. |
| Active organization/branch/location context | **COMPLETED** | Session/request context supports the complete `tenantId + organizationId + branchId + locationId` tuple and preserves prior valid context on failed switches. |
| Organization administration | **IMPLEMENTED — VALIDATION PENDING** | Backend lifecycle operations and Flutter module exist. |
| Branch administration | **IMPLEMENTED — VALIDATION PENDING** | Backend lifecycle operations and Flutter module exist. |
| User administration | **IMPLEMENTED — VALIDATION PENDING** | Backend administration and Flutter list/create/edit/details/access surfaces exist. |
| User → role assignment | **IMPLEMENTED — VALIDATION PENDING** | Backend endpoints and Flutter assignment UI exist. |
| Backend RBAC | **COMPLETED** | Roles, permissions, assignments, effective permissions and middleware implemented. |
| Role management UI | **IMPLEMENTED — VALIDATION PENDING** | Flutter role module and backend CRUD exist. |
| Permission catalog UI | **IMPLEMENTED — VALIDATION PENDING** | Flutter permission module exists and backend listing is gated. |
| Role → permission assignment UI | **IMPLEMENTED — VALIDATION PENDING** | Backend assignment/removal and Flutter surfaces exist. |
| Frontend authorization state | **IMPLEMENTED — VALIDATION PENDING** | AuthZ state/tests exist. |
| Permission-aware navigation | **IMPLEMENTED — VALIDATION PENDING** | Sidebar and shell consume canonical route metadata; backend remains authoritative. |
| Permission-aware route guards | **IMPLEMENTED — VALIDATION PENDING** | Flutter guards exist and wait for authorization readiness. |
| Module enablement/licensing | **IMPLEMENTED — VALIDATION PENDING** | Module access service/middleware exists. |
| Persistent authenticated shell | **IMPLEMENTED — VALIDATION PENDING** | Router owns one authenticated shell and nested content navigator; login/dashboard shell is exercised by CI E2E, while the broader navigation matrix remains. |
| Responsive admin UI migration | **IMPLEMENTED — VALIDATION PENDING** | Upstream responsive layout direction, responsive breakpoints, cards/spacing and Material 3 foundation have been adopted; final device/browser verification remains. |
| Web navigation/routing | **IMPLEMENTED — VALIDATION PENDING** | Router 2.0, route parser/delegate, persistent shell/content navigator, shared route metadata and controlled not-found behavior are implemented; full browser matrix validation remains. |
| Project-wide theme switching | **COMPLETED** | Shared light/dark theme infrastructure is active across login and authenticated responsive layouts. |
| Core frontend/backend E2E | **IMPLEMENTED — VALIDATION PENDING** | Admin and limited-user Flutter Web E2E scenarios now pass in GitHub Actions against deterministic Postgres-backed CI. Broader browser navigation/deep-link/back-forward/refresh/responsive matrix remains. |

## 5. Platform foundation

| Platform capability | Status |
|---|---|
| Authentication service | **IMPLEMENTED — VALIDATION PENDING** |
| Authorization/RBAC service | **COMPLETED** |
| Tenant context / RLS infrastructure | **IMPLEMENTED — VALIDATION PENDING** |
| Platform bootstrap/reference data | **IMPLEMENTED — VALIDATION PENDING** |
| Module access/licensing enforcement | **IMPLEMENTED — VALIDATION PENDING** |
| Audit service / complete audit framework | **PENDING** |
| Notification service / complete notification framework | **PENDING** |
| File storage service | **PENDING** |
| Enterprise configuration framework | **PENDING** |
| Scheduler/background-job platform | **PENDING** |
| Reporting service/infrastructure | **PENDING** |
| Enterprise integration platform | **PENDING** |
| AI platform capability | **PENDING** |
| Localization/internationalization platform | **PENDING** |

## 6. Database, quality and operational foundation

| Area | Status | Notes |
|---|---|---|
| PostgreSQL/Drizzle database layer | **IMPLEMENTED — VALIDATION PENDING** | Current schema, repositories, migrations, connection and RLS infrastructure exist. |
| Migration system | **IMPLEMENTED** | Migration runner and migration set exist. |
| Tenant RLS integration tests | **COMPLETED** | Current integration coverage proves tested transaction-local tenant isolation behavior. |
| Backend unit/integration CI | **COMPLETED** | GitHub Actions Postgres workflow successfully created Postgres 17, created the non-superuser test role/database, ran migrations, seeded fixtures, started the backend, and completed the E2E stages successfully in run 33486274877. |
| Flutter unit/widget tests | **IMPLEMENTED — VALIDATION PENDING** | Auth/AuthZ, role, user, permission and routing tests exist; full browser matrix remains separate. |
| Flutter frontend→backend E2E | **IMPLEMENTED — VALIDATION PENDING** | Admin and limited-user browser E2E scenarios pass in CI; broader navigation/session/responsive matrix remains. |
| Security audit against authoritative security architecture | **PENDING** | Secure token handling, authorization, tenant context, RLS, audit, secrets/logging and fail-closed behavior require final audit. |
| CORE final completion audit | **PENDING** | Required after E2E and security validation. |
| Production deployment validation | **IMPLEMENTED — VALIDATION PENDING** | Vercel → Render backend → PostgreSQL deployment is operational; broader release validation remains. |

## 7. Business modules — implementation queue

Project Management is explicitly removed/deferred and is not an implementation target.

| Sequence | Module | Status |
|---|---|---|
| 1 | Core Enterprise | **IMPLEMENTED — VALIDATION PENDING** |
| 2 | Sales | **PENDING** |
| 3 | Procurement | **PENDING** |
| 4 | Inventory | **PENDING** |
| 5 | Manufacturing | **PENDING** |
| 6 | Finance | **PENDING** |
| 7 | Human Resources | **PENDING** |
| 8 | CRM | **PARTIAL** — Customer foundation and HTTP API are implemented; contacts, leads, opportunities, activities, and broader CRM capabilities remain pending. |
| 9 | Quality Management | **PENDING** |
| 10 | Asset Maintenance | **PENDING** |
| 11 | BI & Analytics | **PENDING** |
| 12 | Workflow / BPM | **PENDING** |

Business modules must not open until the Core Enterprise gate is completed unless an approved architectural decision changes the sequence.

## 8. Verification gate currently in progress

The current verification pass must cover:

1. Flutter Web production build and compilation.
2. Login at desktop, tablet and mobile breakpoints.
3. Light/dark theme switching from login and authenticated layouts.
4. Responsive navigation/sidebar/top-bar behavior.
5. Organization/branch/user/role/permission screens.
6. Authentication → organization/location context → authorization flow.
7. Backend authorization enforcement independent of frontend visibility.
8. Tenant isolation and transaction-local RLS behavior.
9. Regression check for existing backend tests and frontend tests.
10. Vercel production build/deployment verification.
11. Browser route deep-link, back/forward, refresh, and shell-persistence verification.
12. Final security and Core Enterprise audit after technical verification.

**Current evidence:** GitHub Actions Postgres run `33486274877` on commit `8dd4d17edd3f050a66c1bd2c25e47597fda21a95` passed the deterministic Postgres setup, migrations, E2E fixture seed, backend startup, admin Flutter Web E2E, and limited-user Flutter Web E2E. This closes the CI validation gap for those scenarios.

**Roadmap rule:** a verification item is not marked COMPLETED until actual repository/CI/deployment evidence supports it.

## 9. Development rules

- Inspect the current repository before changing a status.
- Do not infer implementation from architecture documentation alone.
- Do not mark a capability completed merely because a screen, service stub, or specification exists.
- Do not resurrect the retired host/deployment TenantResolver architecture.
- Identity-based tenant context is canonical unless superseded by an approved ADR.
- Frontend permission visibility and route guards never replace backend authorization.
- PostgreSQL RLS remains mandatory for tenant-owned data.
- Maintain exactly one roadmap document.
- Work on the current feature branch unless explicitly instructed otherwise; do not create unnecessary branches.
- When implementation materially changes architecture, update the affected authoritative architecture/ADR documentation as required.

## 10. Reconciliation summary

The Core Enterprise frontend now has the planned persistent shell and Router 2.0 implementation with shared navigation metadata and authorization readiness handling. **Deterministic Postgres-backed CI now successfully validates the existing admin and limited-user Flutter Web E2E login/dashboard scenarios. Broader browser navigation, security, and Core Enterprise validation remain the release gate.**

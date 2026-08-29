# Implementation Roadmap

**Status:** Living implementation roadmap  
**Authority:** Architecture documents and Approved ADRs define the intended system; this document records what is actually implemented and what remains to be validated or built.

**Last reconciled:** 2026-08-29  
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

**Current phase:** Core Enterprise foundation implemented; canonical frontend navigation/routing implementation is complete and the final cross-layer verification gate is in progress.

### Implemented

- Production Flutter Web login against deployed backend/database.
- Identity-based tenant discovery and tenant-scoped authentication/session context.
- TenantContext and PostgreSQL transaction-local tenant context infrastructure.
- PostgreSQL RLS integration coverage for tenant isolation/rollback/pool context behavior.
- Organization, branch/location, and user administration backend/API surfaces.
- Flutter organization, branch, user, role, permission, dashboard, and authentication surfaces.
- Backend RBAC and permission enforcement.
- Flutter permission state, permission-aware navigation and route guards.
- Module enablement enforcement.
- Responsive admin UI foundation based on the adopted upstream responsive admin template direction.
- Poppins typography and Material 3-based theme foundation.
- Project-wide light/dark theme switching.
- Persistent authenticated application shell with responsive sidebar/top bar.
- Canonical Flutter Web Router 2.0 navigation implementation with shared route metadata, persistent content navigation, authorization-aware route gates, and controlled not-found handling.

### Not yet complete

- Final browser E2E verification of authenticated navigation/routing.
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
| Login/session frontend | **IMPLEMENTED — VALIDATION PENDING** | Flutter authentication/session restoration exists; deployed login works. Full browser E2E remains. |
| Cross-deployment tenancy verification | **PENDING** | Deployment-independent architecture exists, but required representative cross-deployment verification is not yet evidenced. |
| Ambiguous multi-tenant credential handling | **IMPLEMENTED** | Fail-closed behavior is covered by tests. |

## 4. Core Enterprise

| Capability | Status | Evidence / remaining work |
|---|---|---|
| Authentication | **IMPLEMENTED — VALIDATION PENDING** | Backend authentication, Flutter login and token/session handling exist. |
| Session management / refresh / logout | **IMPLEMENTED — VALIDATION PENDING** | Lifecycle implementation exists; full E2E evidence remains. |
| Organization selection | **IMPLEMENTED — VALIDATION PENDING** | Backend access/select flow and Flutter UI exist. |
| Location/branch selection | **IMPLEMENTED — VALIDATION PENDING** | Backend access/list/select flow and Flutter UI exist. |
| Active organization/location context | **IMPLEMENTED — VALIDATION PENDING** | Session/request context supports it; cross-layer validation remains. |
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
| Persistent authenticated shell | **IMPLEMENTED — VALIDATION PENDING** | Router owns one authenticated shell and nested content navigator. |
| Responsive admin UI migration | **IMPLEMENTED — VALIDATION PENDING** | Upstream responsive layout direction, responsive breakpoints, cards/spacing and Material 3 foundation have been adopted; final device/browser verification remains. |
| Web navigation/routing | **IMPLEMENTED — VALIDATION PENDING** | Router 2.0, route parser/delegate, persistent shell/content navigator, shared route metadata and controlled not-found behavior are implemented; browser matrix validation remains. |
| Project-wide theme switching | **COMPLETED** | Shared light/dark theme infrastructure is active across login and authenticated responsive layouts. |
| Core frontend/backend E2E | **BLOCKED / PENDING VALIDATION** | E2E scenarios exist, but authoritative browser runner evidence remains incomplete. |

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
| Backend unit/integration CI | **IMPLEMENTED** | PostgreSQL CI workflow and repository test coverage exist. |
| Flutter unit/widget tests | **IMPLEMENTED — VALIDATION PENDING** | Auth/AuthZ, role, user, permission and routing tests exist. |
| Flutter frontend→backend E2E | **BLOCKED / PENDING VALIDATION** | Scenarios exist, but authoritative runner evidence remains incomplete. |
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
| 8 | CRM | **PENDING** |
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

The Core Enterprise frontend now has the planned persistent shell and Router 2.0 implementation with shared navigation metadata and authorization readiness handling. **Implementation is complete for the navigation/routing plan; browser, regression, security, and Core Enterprise validation remain the release gate.**

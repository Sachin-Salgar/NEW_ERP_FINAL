# Implementation Roadmap

**Status:** Living implementation roadmap  
**Authority:** Architecture documents and Approved ADRs define the intended system; this document records what is actually implemented and what remains to be validated or built.

**Last reconciled:** 2026-09-05
**Branch:** `feature/sales-documentation-specifications`

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

**Current phase:** Core Enterprise foundation and security boundaries are ready for progression to Sales. Backend quality/container validation and deterministic Postgres-backed validation of migrations, backend startup, admin and limited-user Flutter Web E2E login/dashboard flows pass. The broader browser navigation matrix remains a known validation residual caused by a Flutter teardown assertion after navigation assertions completed.

### Validation evidence captured

- `npx vitest run tests/integration/authentication-flow.test.ts tests/integration/rbac-role-permissions.test.ts --reporter=basic` → exit code 0 on the current `main` branch.
- GitHub Actions run **33486274877**, workflow `CI - Integration Tests (Postgres)`, commit `8dd4d17edd3f050a66c1bd2c25e47597fda21a95` → **success**.
- The successful CI run completed the Postgres setup/migration/fixture/backend startup path and both Flutter Web E2E steps: **Run admin E2E test → success** and **Run limited-user E2E test → success**.
- This CI run validates the repository-controlled test environment; it does not use or depend on Vercel/Render production deployment configuration.
- Remaining browser validation item: the broader authenticated browser navigation matrix is a **KNOWN VALIDATION RESIDUAL**; run `33948006417` fails after navigation assertions with `FocusManager was used after being disposed` during Flutter teardown.

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

### Remaining work and residuals

- Broader browser E2E verification remains a known validation residual; no functional or security assertion failure is evidenced.
- Production deployment and operational security evidence remains deployment-only.
- Full business-module implementation.

## 3. Tenancy, identity and authentication

| Area                                       | Status                               | Current implementation / remaining work                                                                                                                                            |
| ------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant data boundary                       | **COMPLETED**                        | Tenant-scoped model and PostgreSQL RLS architecture implemented.                                                                                                                   |
| Identity-based tenant discovery            | **IMPLEMENTED — VALIDATION PENDING** | Authentication resolves tenant from authenticated user identity and fails closed on ambiguous active matches.                                                                      |
| Tenant-scoped session                      | **IMPLEMENTED — VALIDATION PENDING** | Session carries tenant/user/organization/location context and token lifecycle.                                                                                                     |
| TenantContext                              | **IMPLEMENTED — VALIDATION PENDING** | Server derives tenant from authenticated session; DB helper establishes transaction-local context.                                                                                 |
| PostgreSQL RLS                             | **COMPLETED**                        | Integration coverage proves tested tenant visibility/write isolation, rollback and pooled-connection context isolation.                                                            |
| Legacy host/deployment TenantResolver      | **DEFERRED / RETIRED**               | Replaced by identity-based tenant discovery; do not reintroduce it.                                                                                                                |
| Login/session frontend                     | **IMPLEMENTED — VALIDATION PENDING** | Flutter authentication/session restoration exists; CI now proves admin and limited-user browser login/dashboard flows. Full browser navigation/session-restoration matrix remains. |
| Cross-deployment tenancy verification      | **PENDING**                          | Deployment-independent architecture exists, but required representative cross-deployment verification is not yet evidenced.                                                        |
| Ambiguous multi-tenant credential handling | **IMPLEMENTED**                      | Fail-closed behavior is covered by tests.                                                                                                                                          |

## 4. Core Enterprise

| Capability                                  | Status                                 | Evidence / remaining work                                                                                                                                                                          |
| ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication                              | **COMPLETED**                          | Backend authentication, token/session handling, security tests, and admin/limited-user browser E2E pass in CI.                                                                                     |
| Session management / refresh / logout       | **COMPLETED**                          | Rotation, replay detection, invalidation, logout, and lifecycle tests pass; browser matrix teardown remains a validation residual.                                                                 |
| Organization selection                      | **COMPLETED**                          | Backend access/select flow, default user context, and Flutter working-context UI are implemented and validated in scope.                                                                           |
| Branch selection                            | **COMPLETED**                          | Branch belongs to the active Organization; branch defaults and switching are validated in backend and UI flow.                                                                                     |
| Location selection                          | **COMPLETED**                          | Location belongs to the active Organization; persisted default location and selection validation are implemented.                                                                                  |
| Active organization/branch/location context | **COMPLETED**                          | Session/request context supports the complete `tenantId + organizationId + branchId + locationId` tuple and preserves prior valid context on failed switches.                                      |
| Organization administration                 | **COMPLETED**                          | Backend lifecycle operations, Flutter module, integration coverage, and CI validation exist.                                                                                                       |
| Branch administration                       | **COMPLETED**                          | Backend lifecycle operations, Flutter module, integration coverage, and CI validation exist.                                                                                                       |
| User administration                         | **COMPLETED**                          | Backend administration and Flutter list/create/edit/details/access surfaces are covered by tests and CI.                                                                                           |
| User → role assignment                      | **COMPLETED**                          | Backend endpoints and Flutter assignment UI are covered by tests and CI.                                                                                                                           |
| Backend RBAC                                | **COMPLETED**                          | Roles, permissions, assignments, effective permissions and middleware implemented.                                                                                                                 |
| Role management UI                          | **COMPLETED**                          | Flutter role module and backend CRUD are covered by tests and CI.                                                                                                                                  |
| Permission catalog UI                       | **COMPLETED**                          | Flutter permission module and gated backend listing are covered by tests and CI.                                                                                                                   |
| Role → permission assignment UI             | **COMPLETED**                          | Backend assignment/removal and Flutter surfaces are covered by tests and CI.                                                                                                                       |
| Frontend authorization state                | **COMPLETED**                          | AuthZ state and widget/service tests pass.                                                                                                                                                         |
| Permission-aware navigation                 | **COMPLETED**                          | Sidebar and shell consume canonical route metadata; backend remains authoritative.                                                                                                                 |
| Permission-aware route guards               | **COMPLETED**                          | Flutter guards wait for authorization readiness and are covered by tests.                                                                                                                          |
| Module enablement/licensing                 | **COMPLETED**                          | Module access service/middleware and CRM enablement are implemented and tested.                                                                                                                    |
| Persistent authenticated shell              | **COMPLETED**                          | Router owns one authenticated shell and nested content navigator; login/dashboard shell is exercised by CI E2E.                                                                                    |
| Responsive admin UI migration               | **COMPLETED WITH VALIDATION RESIDUAL** | Responsive layout, breakpoints, cards/spacing and Material 3 foundation are implemented; broad browser-width matrix remains residual.                                                              |
| Web navigation/routing                      | **COMPLETED WITH VALIDATION RESIDUAL** | Router 2.0, route parser/delegate, persistent shell/content navigator, shared route metadata and controlled not-found behavior are implemented; matrix teardown remains residual.                  |
| Project-wide theme switching                | **COMPLETED**                          | Shared light/dark theme infrastructure is active across login and authenticated responsive layouts.                                                                                                |
| Core frontend/backend E2E                   | **COMPLETED WITH VALIDATION RESIDUAL** | Admin and limited-user Flutter Web E2E scenarios pass in GitHub Actions against deterministic Postgres-backed CI. The broader matrix fails only during Flutter teardown after assertions complete. |

## 5. Platform foundation

| Platform capability                                    | Status                               |
| ------------------------------------------------------ | ------------------------------------ |
| Authentication service                                 | **IMPLEMENTED — VALIDATION PENDING** |
| Authorization/RBAC service                             | **COMPLETED**                        |
| Tenant context / RLS infrastructure                    | **IMPLEMENTED — VALIDATION PENDING** |
| Platform bootstrap/reference data                      | **IMPLEMENTED — VALIDATION PENDING** |
| Module access/licensing enforcement                    | **IMPLEMENTED — VALIDATION PENDING** |
| Audit service / complete audit framework               | **PENDING**                          |
| Notification service / complete notification framework | **PENDING**                          |
| File storage service                                   | **PENDING**                          |
| Enterprise configuration framework                     | **PENDING**                          |
| Scheduler/background-job platform                      | **PENDING**                          |
| Reporting service/infrastructure                       | **PENDING**                          |
| Enterprise integration platform                        | **PENDING**                          |
| AI platform capability                                 | **PENDING**                          |
| Localization/internationalization platform             | **PENDING**                          |

## 6. Database, quality and operational foundation

| Area                                                       | Status                                       | Notes                                                                                                                                                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PostgreSQL/Drizzle database layer                          | **IMPLEMENTED — VALIDATION PENDING**         | Current schema, repositories, migrations, connection and RLS infrastructure exist.                                                                                                                                                   |
| Migration system                                           | **IMPLEMENTED**                              | Migration runner and migration set exist.                                                                                                                                                                                            |
| Tenant RLS integration tests                               | **COMPLETED**                                | Current integration coverage proves tested transaction-local tenant isolation behavior.                                                                                                                                              |
| Backend unit/integration CI                                | **COMPLETED**                                | GitHub Actions Postgres workflow successfully created Postgres 17, created the non-superuser test role/database, ran migrations, seeded fixtures, started the backend, and completed the E2E stages successfully in run 33486274877. |
| Flutter unit/widget tests                                  | **IMPLEMENTED — VALIDATION PENDING**         | Auth/AuthZ, role, user, permission and routing tests exist; full browser matrix remains separate.                                                                                                                                    |
| Flutter frontend→backend E2E                               | **IMPLEMENTED — VALIDATION PENDING**         | Admin and limited-user browser E2E scenarios pass in CI; broader navigation/session/responsive matrix remains.                                                                                                                       |
| Security audit against authoritative security architecture | **COMPLETED WITH DEPLOYMENT-ONLY ITEMS**     | Repository controls pass static review, local tests, npm audit, Backend CI, and Trivy. Production key rotation, provider TLS, backup recovery, and operational monitoring remain deployment evidence.                                |
| CORE final completion audit                                | **COMPLETED WITH KNOWN VALIDATION RESIDUAL** | Final audit found no functional/security blocker; Browser Matrix E2E remains an isolated teardown validation residual.                                                                                                               |
| Production deployment validation                           | **IMPLEMENTED — VALIDATION PENDING**         | Vercel → Render backend → PostgreSQL deployment is operational; broader release validation remains.                                                                                                                                  |

## 7. Business modules — implementation queue

Project Management is explicitly removed/deferred and is not an implementation target.

| Sequence | Module             | Status                                                                                                                                                              |
| -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Core Enterprise    | **COMPLETED WITH KNOWN VALIDATION RESIDUAL — READY FOR SALES**                                                                                                      |
| 2        | Sales              | **QUOTATION + SALES ORDER BACKEND SLICES IMPLEMENTED — VALIDATION PENDING** — [Sales specification package](../08-business-modules/03-sales-module-architecture.md) |
| 3        | Procurement        | **PENDING**                                                                                                                                                         |
| 4        | Inventory          | **PENDING**                                                                                                                                                         |
| 5        | Manufacturing      | **PENDING**                                                                                                                                                         |
| 6        | Finance            | **PENDING**                                                                                                                                                         |
| 7        | Human Resources    | **PENDING**                                                                                                                                                         |
| 8        | CRM                | **PARTIAL** — Customer foundation and HTTP API are implemented; contacts, leads, opportunities, activities, and broader CRM capabilities remain pending.            |
| 9        | Quality Management | **PENDING**                                                                                                                                                         |
| 10       | Asset Maintenance  | **PENDING**                                                                                                                                                         |
| 11       | BI & Analytics     | **PENDING**                                                                                                                                                         |
| 12       | Workflow / BPM     | **PENDING**                                                                                                                                                         |

Business modules must not open until the Core Enterprise gate is completed unless an approved architectural decision changes the sequence.

### Current Sales implementation step

The implemented Sales capability includes quotation management, the Sales Order
backend slice under approved ADR-0026, the Sales Delivery backend slice under
ADR-0027, and the Sales Invoice backend slice under ADR-0028. Canonical audit,
optimistic-concurrency, and session-scoped branch/financial-year context
remediation are complete, including forward migrations, repository/schema
contracts, authorization, and validation. Legacy quotation rows without
authoritative context remain a documented data-remediation residual. The
remaining Sales architecture is now documented as an authorization/specification
package without source-code implementation. Credit Note, Pricing,
Discounts, Workflow, integrations, and Reporting remain deferred.

The Sales quotation slice has passed its documented behavioral backend,
PostgreSQL/RLS,
frontend, routing, security, and documentation validation gates. The existing
Browser Matrix E2E teardown residual remains unchanged and must not be hidden
or weakened.

Implementation evidence: backend unit and integration suites pass,
including quotation HTTP authentication coverage and restricted-role
PostgreSQL tenant/organization isolation, soft-delete, rollback, search, and
RLS/FORCE RLS validation. Backend typecheck, lint, build, migration-recovery
verification, production dependency audit, Flutter analyzer, full Flutter
tests, focused Sales route/service tests, and Flutter Web build pass. Full
focused Sales route/service/widget coverage and Flutter Web build pass. The
Sales Order minimum backend slice is implemented under ADR-0026 with
accepted-quotation conversion, immutable session context, server numbering,
RLS/FORCE RLS, audit/versioning, explicit lifecycle routes, and optimistic
transition checks; focused Sales Order unit coverage passes. Docker
and Trivy were unavailable in the validation environment and remain CI-pending;
the Browser Matrix E2E teardown residual remains unchanged.

Specification package evidence:

- [Sales Order](../08-business-modules/sales/02-sales-order.md)
- [Sales Delivery](../08-business-modules/sales/03-sales-delivery.md)
- [Sales Invoice](../08-business-modules/sales/04-sales-invoice.md)
- [Sales Return](../08-business-modules/sales/05-sales-return.md)
- [Sales Credit Note](../08-business-modules/sales/06-sales-credit-note.md)
- [Sales Pricing](../08-business-modules/sales/07-sales-pricing.md)
- [Sales Discounts](../08-business-modules/sales/08-sales-discount.md)
- [Sales Workflow](../08-business-modules/sales/09-sales-workflow.md)
- [Sales Integrations](../08-business-modules/sales/10-sales-integrations.md)
- [Sales Reporting](../08-business-modules/sales/11-sales-reporting.md)

These documents are not implementation authorization; each records
`BUSINESS DECISION REQUIRED` and/or `DEPENDENCY CONTRACT REQUIRED` where the
current architecture is not sufficiently specific.

## 8. Verification gate disposition

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

**Current evidence:** On commit `53ec31ddd635b5b1c0a971e4f060f055da2f67a2`, Backend CI run `33948006381` passed dependency audit, lint, generated-doc verification, migration recovery verification, typecheck, unit tests, build, Docker build, and Trivy. Postgres run `33948006417` passed database setup, migrations, fixtures, backend startup, admin E2E, and limited-user E2E; only the browser navigation matrix failed with a post-test `FocusManager was used after being disposed` assertion.

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

The Core Enterprise frontend has the planned persistent shell and Router 2.0 implementation with shared navigation metadata and authorization readiness handling. **Core Enterprise is implementation/security ready for progression to Sales, with Browser Matrix E2E retained as a known validation residual.** This residual must not be described as a green browser matrix or as completed production deployment evidence.

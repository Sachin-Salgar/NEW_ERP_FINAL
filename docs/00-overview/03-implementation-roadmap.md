# Implementation Roadmap

**Status:** Living implementation roadmap  
**Authority:** Architecture documents and Approved ADRs define the intended system; this document records what is actually implemented and what remains to be validated or built.

**Last reconciled:** 2026-09-10
**Branch:** `ai/audit-fixes-2026-09`

## Status definitions

- **COMPLETED** — implementation exists and repository/CI evidence supports completion for the stated scope.
- **IMPLEMENTED — VALIDATION PENDING** — implementation exists, but required end-to-end, security, or operational validation remains.
- **PARTIAL** — meaningful implementation exists, but material capability remains incomplete.
- **PENDING** — not implemented in the current repository.
- **BLOCKED** — validation/implementation is currently blocked by a known issue.
- **DEFERRED** — intentionally outside the current sequence.

## 1. Architecture baseline

The system is a **layered modular monolith** with Flutter clients, REST API, backend services, repositories/data access, and PostgreSQL.

The current approved architecture follows **ADR-0040: Platform, Tenant, and
Branch Architecture**. The platform is the system administration boundary;
Tenant is the security, authorization, data-isolation, and PostgreSQL RLS
boundary; Branch is the only business subdivision below Tenant. A normal
application user currently belongs to exactly one tenant and normal login
establishes that tenant automatically. Tenant switching and post-login tenant
switching remain unsupported.

**ADR-0042 is Approved architecture. Phase 1 backend implementation is complete
for identity-wide usable-context resolution, pending-selection challenges, and
context-specific session issuance. Phase 2 Flutter integration is also complete,
including direct tenant/platform routing and pending context selection.**
Deployment hostname, frontend URL, client-supplied tenant ID, and deployment
configuration are not tenant authorities.

PostgreSQL RLS remains the database isolation boundary, with trusted server-side tenant context established transaction-locally.

The old host/deployment **TenantResolver is retired** and is not a current implementation target.

## 2. Current checkpoint

**Current phase:** Unified Login Phase 1 backend and Phase 2 Flutter integration
are complete. The bounded Audit Query / Read API slice is now implemented and
validated. Sales remains a partial module with bounded foundations implemented;
its remaining capabilities require their separate specifications and dependency
boundaries before implementation is selected.

### Validation evidence captured

- Audit branch `ai/audit-fixes-2026-09` adds the documented `erp_app` bootstrap
  before migrations, standardizes integration CI on Node 22 and `npm ci`,
  seeds active local password credentials for both E2E identities, and aligns
  ADR-0042 challenge snapshots and canonical context ordering with the domain
  contract.
- On the audit branch, `npm ci`, `npm run typecheck`, `npm run build`,
  `npm run lint -- --no-fix`, `npm run db:verify-recovery`,
  `npm run test:unit`, the focused migration/security integration tests,
  `flutter analyze`, and the full Flutter test suite pass. The full
  PostgreSQL integration suite remains unavailable against the configured
  shared local database because it contains invalid stale identity data and
  encounters concurrent RLS setup updates; no database was modified to bypass
  those failures.
- GitHub Actions integration run **34677762985** on the audit branch passed
  database setup, migrations, fixture seeding, backend startup, admin E2E,
  limited-user E2E, and browser navigation matrix E2E. AI Workflow Validation
  run **34677763002** also passed.
- Subsequent audit commits `495b448` and `9a1776b` corrected release-test
  database URL resolution and provisioned the non-login, non-superuser,
  non-RLS-bypassing `erp_app` role in every remaining backend integration
  workflow. GitHub Actions integration run **34678706337** and AI Workflow
  Validation run **34678706323** both passed on commit `9a1776b`.
- The ADR terminology audit confirmed `Approved` as the only authoritative
  binding status vocabulary. ADR-0037, ADR-0038, ADR-0039, and ADR-0042,
  their index reference, and the ADR-0042 roadmap reference now use
  `Approved`; the next available identifier is corrected to ADR-0043.
  ADR-0032 has no status metadata and ADR-0025 through ADR-0039 are absent
  from the ADR index; these remain governance/documentation follow-ups because
  the repository does not provide enough authoritative metadata to invent
  their status or index scope.
- `npx vitest run tests/integration/authentication-flow.test.ts tests/integration/rbac-role-permissions.test.ts --reporter=basic` → exit code 0 on the current `main` branch.
- ADR-0041 defines the branch working-context and authorization model. The
  implementation is in place on the feature branch, with unit, typecheck, lint,
  build, and diff validation passing; database-backed branch authorization proof
  remains pending.
- The bounded Audit Query / Read API uses the existing
  `/api/v1/security/audit-logs` route and `security.audit_log.read` permission,
  adds repository-backed tenant-scoped filtering for actor, action, resource,
  correlation ID, and timestamp range, deterministic timestamp/ID ordering, and
  page/page_size pagination. Unit tests, the PostgreSQL audit atomicity/RLS
  integration test, typecheck, build, lint, AI workflow validation, repository
  scanning, and `git diff --check` pass. No migration was required because the
  existing audit query indexes cover the approved filters.
- GitHub Actions run **33486274877**, workflow `CI - Integration Tests (Postgres)`, commit `8dd4d17edd3f050a66c1bd2c25e47597fda21a95` → **success**.
- The successful CI run completed the Postgres setup/migration/fixture/backend startup path and both Flutter Web E2E steps: **Run admin E2E test → success** and **Run limited-user E2E test → success**.
- This CI run validates the repository-controlled test environment; it does not use or depend on future managed deployment configuration.
- Remaining browser validation item: the broader authenticated browser navigation matrix is a **KNOWN VALIDATION RESIDUAL**; run `33948006417` fails after navigation assertions with `FocusManager was used after being disposed` during Flutter teardown.
- ADR-0040 fresh zero-state acceptance passed against a temporary local PostgreSQL database: all migrations from zero, production bootstrap CLI, platform and tenant HTTP authentication/context, tenant isolation, platform-to-tenant separation, membership revocation, audit attribution, and audit-failure rollback.
- Focused ADR-0040 proof on `audit/strict-architecture-proof-20260908`: `npx vitest run --config vitest.integration.config.ts tests/integration/authentication-flow.test.ts tests/integration/authorization-flow.test.ts tests/integration/phase2-platform-security.test.ts tests/integration/zero-state-platform-acceptance.test.ts tests/integration/tenant-rls.test.ts tests/integration/custom-tenant-seed.test.ts --reporter=basic` → **6 files / 9 tests passed**. The zero-state test now resolves its temporary database through the administrative integration configuration rather than application `DATABASE_URL`.
- `npm run typecheck`, `npm run lint -- --no-fix`, `python tools/ai/validate_ai_workflow.py`, `python tools/ai/repository_scanner.py`, `npm run db:diagnose`, and `git diff --check` passed for this proof run.
- Machine-derived permission inventory passed with zero catalog-only or missing enforcement references.
- Phase 4C seed cleanup now uses Tenant → Branch fixtures only; targeted seed lint and JavaScript syntax validation pass. The custom-tenant integration test remains blocked before test execution by migration `0009_tenant_branch_architecture.sql` failing with `ON CONFLICT DO UPDATE command cannot affect row a second time`.
- Unified Login Phase 1 backend: commit `a0b20b8442853923f368da1749bc67977dba22ea`; serialized PostgreSQL integration suite passed with 21/21 files and 30/30 tests.
- Unified Login Phase 2 Flutter integration: commit `97dfcb9da058c4ebedeae1acc33d683eec66e964`; Flutter analyzer, 86 Flutter tests, formatting, Flutter Web release build, repository typecheck/lint/build, 159 unit tests, migration-recovery verification, AI workflow validation, and diff checks passed.

### Implemented

- Production Flutter Web login against deployed backend/database.
- Unified Login establishes direct tenant or platform sessions for exactly one usable context and uses server-authorized pending selection for multiple contexts; Phase 1 backend and Phase 2 Flutter integration are complete under ADR-0042.
- Platform administrator operator bootstrap (`scripts/platform-admin.ts`) and separate platform-session authorization are proven; the custom tenant seed does not create a platform administrator.
- Tenant-scoped authentication/session context derived from trusted server state.
- TenantContext and PostgreSQL transaction-local tenant context infrastructure.
- PostgreSQL RLS integration coverage for tenant isolation/rollback/pool context behavior.
- Branch and user administration backend/API surfaces under the Platform → Tenant → Branch architecture.
- Flutter tenant, branch, user, role, permission, dashboard, and authentication surfaces.
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
- Bounded Purchase module backend and Flutter navigation vertical slice, including supplier soft-delete, requisition/order lifecycle actions, receipt-to-Inventory integration, purchase permissions/module registration, tenant RLS, optimistic versioning, and migration recovery governance.

### Remaining work and residuals

- Broader browser E2E verification remains a known validation residual; no functional or security assertion failure is evidenced.
- No authoritative retention or cleanup period is defined for expired or
  consumed `pending_login_challenges`; lifecycle policy remains a documentation
  and governance gap, so no purge mechanism has been invented.
- Production deployment and operational security evidence remains deployment-only.
- Full business-module implementation.

## IMMEDIATE NEXT IMPLEMENTATION TASK

**Select the next bounded implementation unit through roadmap reconciliation.**

The bounded Purchase v1 implementation and its dedicated hardening validation
are complete for suppliers, requisitions, purchase orders, receipts, lifecycle
transitions, optimistic version checks, FORCE RLS, authorization, Inventory
receipt integration, transaction rollback, idempotency, and the focused Flutter
workflow client. Sales remains PARTIAL, but its remaining capabilities are
separately specified and include unresolved workflow/provider and business-rule
boundaries.

Prerequisites already satisfied:

- Core Enterprise architecture and security gate is complete with the known
  browser teardown residual retained.
- ADR-0040 tenant/platform identity, session, and RLS foundations are in place.
- ADR-0041 branch working-context and authorization implementation and focused
  proofs are in place.
- ADR-0042 Unified Login Phase 1 backend and Phase 2 Flutter integration are
  complete and validated.
- Procurement Purchase v1 backend/frontend bounded implementation and module
  contracts already exist.

Remaining blockers and residuals:

- Procurement Purchase v1 is complete for its bounded implementation and
  validation scope; broader Procurement capabilities remain out of scope.
- Broader browser navigation/session/responsive validation remains a known
  teardown residual.
- Purchase returns, RFQ/supplier quotations, vendor invoices, and payment
  processing remain outside Purchase v1 and are not part of this task.

## 3. Tenancy, identity and authentication

| Area                                       | Status                               | Current implementation / remaining work                                                                                                                                            |
| ------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant data boundary                       | **COMPLETED**                        | Tenant-scoped model and PostgreSQL RLS architecture implemented.                                                                                                                   |
| Identity-wide usable-context resolution    | **COMPLETED**                        | Unified backend login resolves current tenant/platform contexts after credential authentication; zero fails closed, one issues a direct context session, and multiple issue only a one-time pending challenge. Phase 1 is recorded in commit `a0b20b8442853923f368da1749bc67977dba22ea`. |
| Tenant-scoped session                      | **COMPLETED**                        | Normal login resolves exactly one active tenant server-side, fails closed on ambiguity/no match, and issues a tenant-bound session and JWT.                                                               |
| TenantContext                              | **IMPLEMENTED — VALIDATION PENDING** | Server derives tenant from authenticated session; DB helper establishes transaction-local context.                                                                                 |
| PostgreSQL RLS                             | **COMPLETED**                        | Integration coverage proves tested tenant visibility/write isolation, rollback and pooled-connection context isolation.                                                            |
| Legacy host/deployment TenantResolver      | **DEFERRED / RETIRED**               | Tenant authority remains server-established from the authenticated tenant account; do not reintroduce host or client tenant resolution.                                           |
| Login/session frontend                     | **COMPLETED**                        | Flutter authentication/session restoration and Unified Login Phase 2 direct tenant/platform routing and pending selection are complete in commit `97dfcb9da058c4ebedeae1acc33d683eec66e964`; the broader browser matrix remains a separate known residual. |
| Cross-deployment tenancy verification      | **PENDING**                          | Deployment-independent architecture exists, but required representative cross-deployment verification is not yet evidenced.                                                        |
| Ambiguous multi-tenant credential handling | **IMPLEMENTED**                      | Fail-closed behavior is covered by tests.                                                                                                                                          |

## 4. Core Enterprise

| Capability                                  | Status                                 | Evidence / remaining work                                                                                                                                                                          |
| ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication                              | **COMPLETED**                          | Backend authentication, token/session handling, security tests, and admin/limited-user browser E2E pass in CI.                                                                                     |
| Session management / refresh / logout       | **COMPLETED**                          | Rotation, replay detection, invalidation, logout, and lifecycle tests pass; browser matrix teardown remains a validation residual.                                                                 |
| Login-time context selection                | **COMPLETED**                         | `/auth/select-context` atomically consumes a short-lived challenge, re-resolves current membership state, and issues only the selected tenant/platform session; no post-login tenant switching is introduced. Backend and Flutter implementation and validation are complete under ADR-0042. |
| Branch selection                            | **IMPLEMENTED — VALIDATION PENDING**   | Branch is the only business subdivision below Tenant; branch defaults/access remain the supported working-context contract.                                                                        |
| Generic location selection                  | **DEFERRED / RETIRED**                 | Generic Location is not an architecture level; domain-specific physical locations remain owned by their bounded module where applicable.                                                           |
| Active tenant/branch context                | **IMPLEMENTED — VALIDATION PENDING**   | Active fixture/bootstrap context is tenant-scoped with branch access.                                                                                                                               |
| Tenant administration                       | **COMPLETED**                          | Tenant lifecycle and membership administration are the active platform boundary.                                                                                                                     |
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
| Production deployment validation                           | **IMPLEMENTED — VALIDATION PENDING**         | Frontend/backend/database deployment remains provider-specific; broader release validation remains.                                                                                                                                |

## 7. Business modules — implementation queue

Project Management is explicitly removed/deferred and is not an implementation target.

| Sequence | Module             | Status                                                                                                                                                                                                                |
| -------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Core Enterprise    | **COMPLETED WITH KNOWN VALIDATION RESIDUAL — READY FOR SALES**                                                                                                                                                        |
| 2        | Sales              | **PARTIAL — QUOTATION, ORDER, DELIVERY, INVOICE, RETURN, CREDIT NOTE, PRICING, AND DISCOUNT BOUNDED FOUNDATIONS IMPLEMENTED** — [Sales specification package](../08-business-modules/03-sales-module-architecture.md) |
| 3        | Procurement        | **COMPLETE** — bounded Purchase v1 backend/frontend slice and dedicated API, RLS, transaction, Inventory, idempotency, concurrency, authorization, Flutter, and repository validation are complete.   |
| 4        | Inventory          | **PARTIAL — ITEM MASTER, WAREHOUSE, STOCK, RESERVATION, FULFILLMENT, AND RETURN MOVEMENT FOUNDATION IMPLEMENTED; ADVANCED OPERATIONS REMAIN DEFERRED**                                                                |
| 5        | Manufacturing      | **PENDING**                                                                                                                                                                                                           |
| 6        | Finance            | **PARTIAL — bounded posting foundation implemented; broader accounting remains pending**                                                                                                                              |
| 7        | Human Resources    | **PENDING**                                                                                                                                                                                                           |
| 8        | CRM                | **PARTIAL** — Customer foundation and HTTP API are implemented; contacts, leads, opportunities, activities, and broader CRM capabilities remain pending.                                                              |
| 9        | Quality Management | **PENDING**                                                                                                                                                                                                           |
| 10       | Asset Maintenance  | **PENDING**                                                                                                                                                                                                           |
| 11       | BI & Analytics     | **PENDING**                                                                                                                                                                                                           |
| 12       | Workflow / BPM     | **PENDING**                                                                                                                                                                                                           |

Business modules must not open until the Core Enterprise gate is completed unless an approved architectural decision changes the sequence.

### Current Sales implementation step

The implemented Sales capability includes quotation management, the Sales Order
backend slice under approved ADR-0026, the Sales Delivery backend slice under
ADR-0027, and the Sales Invoice backend slice under ADR-0028. Sales Return,
Credit Note, Pricing, and Discount bounded foundations are also implemented.
Canonical audit,
optimistic-concurrency, and session-scoped branch/financial-year context
remediation are complete, including forward migrations, repository/schema
contracts, authorization, and validation. Quotation updates and lifecycle
transitions now require and atomically enforce the expected version, and
canceling a reserved order releases its Inventory reservations before the
order transition. Legacy quotation rows without
authoritative context remain a documented data-remediation residual. The
Workflow remains not connected, while provider-neutral integration boundaries
and a bounded Sales document-summary report are implemented. Finance and Tax
remain authoritative bounded dependencies. Transaction-facing Pricing/Discount
resolution is implemented for quotation creation and draft updates, with
immutable snapshots copied through order and invoice conversion. The Inventory
provider is
implemented. Under approved ADR-0035, new Sales quotation lines can carry Item
Master identity, order conversion requires an active tenant-owned warehouse and
item identity, and confirmed orders expose an idempotent reservation operation
through the typed Inventory boundary. Historical rows remain nullable and are
not backfilled. Delivery fulfillment is now activated through the typed
Inventory boundary: delivery creation requires order reservations, copies
item/warehouse identity, and delivery completion fulfills all source
reservations idempotently. Sales Return processing now invokes Inventory
return-to-stock under ADR-0037 with deterministic idempotency and transaction
rollback. An inventory-bounded
Item Master vertical slice is now implemented under the Inventory boundary with
RLS/FORCE RLS, permission/module gating, audit/versioning, optimistic concurrency,
and authenticated API coverage. The bounded Inventory foundation now persists
tenant-owned warehouses, stock balances, reservations, fulfillment issues,
receipts, and return movements under ADR-0034. Sales transaction item/warehouse
references are now additive in the order contract; delivery and return
orchestration are connected for new Inventory-backed records. The bounded Tax foundation is implemented under
ADR-0038 with tenant-scoped deterministic rules, authenticated API
administration, RLS/FORCE RLS, and invoice tax snapshots. The bounded Finance
posting foundation is implemented under ADR-0039 with idempotent invoice and
credit-note postings, RLS/FORCE RLS, and Sales references. Workflow, Documents,
Notifications, and external adapters remain provider-neutral where no concrete
provider exists.
Sales administration
and lifecycle frontend coverage is implemented, including confirmed-order to
delivery creation; historical quotation rows without authoritative context
remain decision-gated and must not be arbitrarily reclassified.

The Sales quotation slice has passed its documented behavioral backend,
PostgreSQL/RLS,
frontend, routing, security, and documentation validation gates. The existing
Browser Matrix E2E teardown residual remains unchanged and must not be hidden
or weakened.

Implementation evidence: backend unit and integration suites pass,
including quotation HTTP authentication coverage and restricted-role
PostgreSQL tenant isolation, soft-delete, rollback, search, and
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

These documents record the implemented bounded foundations and the remaining
dependency boundaries. Workflow/BPM provider behavior and cross-module
integration effects remain explicitly not connected.

## 8. Verification gate disposition

The current verification pass must cover:

1. Flutter Web production build and compilation.
2. Login at desktop, tablet and mobile breakpoints.
3. Light/dark theme switching from login and authenticated layouts.
4. Responsive navigation/sidebar/top-bar behavior.
5. Branch/user/role/permission screens.
6. Authentication → tenant/branch context → authorization flow.
7. Backend authorization enforcement independent of frontend visibility.
8. Tenant isolation and transaction-local RLS behavior.
9. Regression check for existing backend tests and frontend tests.
10. Vercel production build/deployment verification.
11. Browser route deep-link, back/forward, refresh, and shell-persistence verification.
12. Final security and Core Enterprise audit after technical verification.

**Current evidence:** The audit branch has passed local dependency installation,
typecheck, lint, build, unit, focused migration/security integration, migration
recovery, Flutter analyzer, and Flutter tests. GitHub Actions run
`34677762985` passed database setup, migrations, fixtures, backend startup,
admin E2E, limited-user E2E, and browser navigation matrix E2E; AI Workflow
Validation run `34677763002` passed as well. The full local PostgreSQL suite
still encounters stale shared-database contamination and concurrent RLS setup
updates, so CI is the authoritative clean-database evidence for this branch.

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

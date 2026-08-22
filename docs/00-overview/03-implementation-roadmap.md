# Implementation Roadmap (Living)

This implementation roadmap is the canonical, living implementation document for NEW_ERP_FINAL. It records both the high-level ERP roadmap and the detailed implementation sequence, including a persistent implementation ledger, current checkpoint, and a verified next-step instruction for humans and AI agents.

This file is authoritative for the immediate development state and must be consulted by every implementation session before coding work begins.

Generated snapshot: 2026-08-22T16:50:04+05:30
Last evidence-aware update: 2026-08-22 (see Implementation History)

---

STATUS LEGEND

- NOT STARTED
- PLANNED
- IN PROGRESS
- BLOCKED
- BACKEND COMPLETE
- FRONTEND IN PROGRESS
- TESTING
- COMPLETED
- DEFERRED

USAGE NOTE

- A step is marked COMPLETED only when: implementation exists, required tests exist, validation passes, security requirements are satisfied, authoritative documentation requirements are satisfied, and no known blocking gaps remain.
- If a step requires product or governance decisions, record those decisions and mark the step NEEDS HUMAN DECISION until resolved.

---

CURRENT IMPLEMENTATION CHECKPOINT

This checkpoint is updated after every meaningful implementation step and is the single source of truth for "what to work on next".

Current phase: Implementation / CORE-01 vertical completion
Current slice: CORE-01 — Core Enterprise (organization, branch, user, RBAC)
Current step: CORE-01 → AUTH-02 (frontend authorization & RBAC UX) — pre-implementation mapping
Current status: IN PROGRESS (overall CORE-01 = PARTIALLY COMPLETE)
Last completed step: CORE-01 authentication & context flow (frontend session restoration and selection) — Commit: 08cccf7
Current objective: Prepare and begin AUTH-02 frontend implementation by mapping backend RBAC contracts to frontend authorization architecture and defining the frontend authorization state model.
Remaining work (top-level): implement frontend authorization admin UX, permission-aware navigation, run full backend integration tests, and execute frontend→backend E2E validations.
Blockers: product decisions required for organization-scoped role assignment semantics (if needed), CI E2E infrastructure for integrated DB-backed tests, environment for Flutter E2E execution.
Architectural decisions pending: whether role assignment requires organization/location scoping at the data model layer or can be represented via tenant-scoped roles + effective-permission model. (Document decision before modifying DB schema.)
Immediate next action: AUTH-02.01 — inspect and map the actual backend RBAC contracts to the frontend authorization architecture and produce a small implementation plan (files, service, API calls, tests).
Do-not-start-yet modules: SALES-01, PROCUREMENT-01, INVENTORY-01, FINANCE-01, CRM-01, MANUFACTURING-01 (the Business Module Gate is closed until CORE-01 final audit passes)

---

1) HIGH-LEVEL ERP ROADMAP (preserve existing sequence)

- TENANCY-01 — Tenant isolation / PostgreSQL RLS (DB-level)
- AUTH-01 — Authentication (backend session lifecycle, login/refresh/logout)
- AUTH-02 — Authorization (RBAC: roles, permissions, assignment, evaluation)
- CORE-01 — Core Enterprise (Organization / Branch / User / Role / Permission foundational features) — vertical E2E completion
- Business modules (enable only after CORE platform gate): SALES-01, PROCUREMENT-01, INVENTORY-01, FINANCE-01, CRM-01, MANUFACTURING-01, etc.

Notes: This high-level ordering is taken from authoritative docs and ADRs. Do not change module ordering without an approved ADR.

---

2) DETAILED IMPLEMENTATION SEQUENCE (CORE-01 expanded)

This section decomposes CORE-01 into step-by-step items that record required implementation and validation gates. Each step must be assigned a status from the STATUS LEGEND.

CORE-01 Detailed Steps

- CORE-01.01 Authentication — [COMPLETED (backend), PARTIAL (frontend)]
  - Backend routes and services implemented.
  - Frontend login implemented and validated (widget tests).
  - Evidence: src/application/services/authentication-service.ts, frontend/lib/core/auth/auth_service.dart, frontend/lib/modules/auth/login_screen.dart

- CORE-01.02 Session management — [COMPLETED (backend+frontend)]
  - Session creation, refresh, validation implemented. Frontend stores tokens in secure storage and restores session at startup.
  - Evidence: authentication-service.ts, auth_service.dart

- CORE-01.03 Tenant resolution/context — [PARTIAL]
  - Backend supports host-based and config-based tenant resolution. Frontend uses tenant header and API paths; host-based bootstrap E2E not validated.
  - Evidence: tenant-resolution-service.ts, frontend bootstrapping code

- CORE-01.04 Organization selection — [PARTIAL]
  - Backend list/select endpoints implemented; frontend selection UI implemented and guarded by router.
  - Evidence: core-enterprise.ts, organization_selection_screen.dart

- CORE-01.05 Location selection — [PARTIAL]
  - Backend location access and list endpoints implemented; frontend selection UI implemented and propagates active location.
  - Evidence: location-service.ts, location_selection_screen.dart

- CORE-01.06 Active location context — [PARTIAL]
  - Active location supported by backend (server session) and frontend sets active location in session context. Needs E2E validation.
  - Evidence: authentication-service.createSessionForUser, frontend auth state propagation

- CORE-01.07 Organization administration — [PARTIAL]
  - Backend CRUD routes exist; frontend screens for list/create/edit exist (presentation-only). Validation pending.
  - Evidence: core-enterprise routes, frontend/modules/organization/*

- CORE-01.08 Branch/location administration — [PARTIAL]
  - Backend CRUD routes exist; frontend screens for list/create/edit exist (presentation-only). Validation pending.
  - Evidence: core-enterprise routes, frontend/modules/branch/*

- CORE-01.09 User administration — [PARTIAL]
  - Backend user endpoints exist; frontend user CRUD and access assignment UI exist. Role/permission assignment UI is missing.
  - Evidence: frontend/modules/user/*, core-enterprise routes

- CORE-01.10 Backend RBAC — [COMPLETE (backend)]
  - Roles, permissions, role-permission assignment, user-role assignment, authorizationService, requirePermission middleware, and integration tests exist.
  - Evidence: src/presentation/http/routes/rbac.ts, src/application/services/authorization-service.ts, postgres repo

- CORE-01.11 Frontend authorization state — [NOT STARTED / PLANNED]
  - Define AuthZ state model (effective permissions, cached permissions, permission refresh patterns).
  - UI integration points for permission-dependent visibility must be defined.

- CORE-01.12 Roles management UI — [NOT STARTED]
  - Roles list/create/edit UI, wired to /rbac/roles endpoints.

- CORE-01.13 Permission catalog UI — [NOT STARTED]
  - Permission listing UI; read-only catalog of available permissions per tenant.

- CORE-01.14 Role → permission assignment UI — [NOT STARTED]
  - UI to assign/remove permission keys to roles (POST/DELETE /rbac/roles/:roleId/permissions).

- CORE-01.15 User → role assignment UI — [NOT STARTED]
  - UI to assign/revoke roles to/from users (POST/DELETE /rbac/users/:userId/roles).

- CORE-01.16 Permission-aware navigation — [NOT STARTED]
  - Client-side module/menu visibility based on effective permissions (presentation-only; backend remains authoritative).

- CORE-01.17 Permission-aware route guards — [NOT STARTED]
  - Route guards checking effective permissions before navigating to module routes (UX convenience only; server still enforces access).

- CORE-01.18 Authorization frontend tests — [NOT STARTED]
  - Widget and integration tests covering roles/permissions UI and permission-driven visibility.

- CORE-01.19 Backend integration / RLS / RBAC validation — [IN PROGRESS]
  - Execute all tests/integration RBAC and tenant RLS tests in CI with test DB.

- CORE-01.20 Frontend → backend E2E validation — [NOT STARTED]
  - E2E scenarios simulating real host-based tenant resolution and RBAC enforcement.

- CORE-01.21 Security audit — [NOT STARTED]
  - Validate secure storage, no secrets in logs, RLS policies, and audit trails meet security docs.

- CORE-01.22 CORE-01 final completion audit — [NOT STARTED]
  - Final evidence-backed audit confirming all items implemented, validated, and secure.

Each step above must be updated with the Evidence Requirement block after it is completed.

---

3) CURRENT IMPLEMENTATION CHECKPOINT (DETAILED)

- Current slice: CORE-01 (Core Enterprise)
- Current phase: AUTH-02 preparation (frontend authorization mapping)
- Current step: AUTH-02.01 — map backend RBAC contracts to frontend authorization architecture (IMMEDIATE NEXT STEP)
- Status: IN PROGRESS (CORE-01 overall = PARTIALLY COMPLETE)
- Last completed developer-visible commit: 08cccf7 — feat(core): complete CORE-01 frontend flow
  - Implemented: authentication, session restoration, tenant context, organization selection, location selection, active-location context, route guards, frontend tests
- Remaining critical objectives before CORE-01 final audit:
  - Implement frontend RBAC admin UI (roles/permissions/assignments)
  - Implement permission-aware navigation and route guards
  - Run full backend integration tests and RLS tests in CI
  - Execute frontend→backend E2E including host-based tenant resolution and RBAC enforcement
  - Complete security audit
- Blockers and pending decisions:
  - Organization-scoped vs tenant-scoped role assignment semantics (product decision required)
  - Provisioning of CI environment for DB-backed integration/E2E tests
  - Confirmation on public vs admin-only user registration (currently admin-only per product decision)
- Immediate next action (single):
  - AUTH-02.01 — Inspect and map the actual backend RBAC contracts to the frontend authorization architecture. Deliverable: mapping document that lists exactly which backend endpoints and payloads will be used by each frontend UI screen, required frontend service methods (AuthZService), caching/refresh rules, and a minimal list of frontend tests to implement first.

---

4) IMPLEMENTATION HISTORY (chronological ledger)

- 2026-08-20
  - Snapshot: ded0b71ad... (roadmap generation)

- 2026-08-22
  - CORE-01 frontend auth/context work committed
  - Commit: 08cccf7 — feat(core): complete CORE-01 frontend flow
  - Sub-scope implemented: login, session restore, organization selection, location selection, active-location context, routing guards, frontend widget tests
  - Status: recorded as completed for those sub-items; overall CORE-01 remains PARTIALLY COMPLETE

- <future entries> — append new commits with date, short description, and status

---

5) AUTH-02 DETAILED SEQUENCE (Frontend Authorization / RBAC)

AUTH-02 is the next major frontend slice and must be implemented in small verifiable steps. It depends on the existing backend RBAC implementation.

AUTH-02 tasks (recommended ordering):

- AUTH-02.01 Inspect backend authorization contracts (IMMEDIATE NEXT STEP)
  - Inspect routes: GET /api/v1/rbac/roles, POST /rbac/roles, PATCH /rbac/roles/:id, GET /rbac/permissions, POST /rbac/roles/:roleId/permissions, POST /rbac/users/:userId/roles, DELETE /rbac/users/:userId/roles/:roleId, GET /rbac/users/:userId/effective-permissions
  - Output: mapping doc (APIs → frontend methods), JSON examples, error shapes, required headers (tenant/authorization)
  - Status: NOT STARTED → IN PROGRESS (set as current)

- AUTH-02.02 Define frontend authorization state and service
  - Design AuthZService to load effective permissions and expose permission checks and eventing to UI
  - Define caching, refresh, and invalidation strategies
  - Status: NOT STARTED

- AUTH-02.03 Implement authorization service (AuthZService)
  - Methods: loadEffectivePermissions(userId), hasPermission(key), getPermissionKeys(), refreshPermissions()
  - Integrate with existing AuthService and ApiClient
  - Status: NOT STARTED

- AUTH-02.04 Load effective permissions on session restore
  - After successful session restore, fetch effective permissions and cache for UI
  - Status: NOT STARTED

- AUTH-02.05 Implement roles list UI (frontend)
  - List roles, paginated if needed, with tenant context
  - Status: NOT STARTED

- AUTH-02.06 Implement create role UI
  - Form to create role -> POST /rbac/roles
  - Status: NOT STARTED

- AUTH-02.07 Implement edit role UI
  - Role details and PATCH /rbac/roles/:id
  - Status: NOT STARTED

- AUTH-02.08 Implement permission catalog UI
  - GET /rbac/permissions, display by module/resource/action/scope
  - Status: NOT STARTED

- AUTH-02.09 Implement role-permission assignment UI
  - Assign/remove permissions to roles (POST/DELETE /rbac/roles/:roleId/permissions)
  - Status: NOT STARTED

- AUTH-02.10 Implement user-role assignment UI
  - POST /rbac/users/:userId/roles and DELETE /rbac/users/:userId/roles/:roleId
  - Status: NOT STARTED

- AUTH-02.11 Implement permission-aware navigation
  - Menu and module visibility driven by AuthZService.hasPermission
  - Ensure UX degrades gracefully until permissions loaded (show loading placeholders)
  - Status: NOT STARTED

- AUTH-02.12 Implement permission-aware route handling
  - Route guards that consult AuthZService.hasPermission before navigation (client-side convenience only)
  - Status: NOT STARTED

- AUTH-02.13 Add frontend tests for AuthZ flows
  - Widget tests and integration tests that mock backend responses and assert UI visibility and assignment operations
  - Status: NOT STARTED

- AUTH-02.14 Validate against backend (integration)
  - Run select integration tests using a test DB and exercise role/permission assignment flows end-to-end
  - Status: NOT STARTED

- AUTH-02.15 AUTH-02 final audit
  - Evidence-backed audit with tests and validation results to mark AUTH-02 COMPLETE
  - Status: NOT STARTED

Notes: Each AUTH-02 step must record the evidence block (files, tests, validation commands, commit SHA) when moved to COMPLETED.

---

6) VALIDATION STATE

- Local validations performed during last implementation: flutter analyze (frontend), flutter test (frontend), npm run typecheck (backend) — these passed during implementation of the auth/context flow.
- Tests existing but requiring DB: tests/integration/* (authorization-flow, core-01 organization tests, tenant RLS tests). These must run in CI with a test Postgres instance.
- Required validation before marking CORE-01 COMPLETE:
  - Full backend integration tests (run in CI with DB)
  - Full frontend tests (flutter analyze + flutter test)
  - Frontend→backend E2E tests exercising host-based tenant resolution, session restoration, org selection, location selection, role/permission assignment, and RBAC enforcement
  - Security audit checks

---

7) BLOCKERS / ARCHITECTURAL DECISIONS

- Organization-scoped role assignment: the backend currently models user_roles as tenant-scoped. If organization-scoped role assignment is required by product, an ADR and data-model change is needed. DO NOT change the DB schema without ADR approval.
- CI E2E infrastructure: requires a stable test Postgres instance and a plan for test data isolation. Set up a CI job to run integration tests with explicit teardown.
- Product decisions for UI UX and admin flows: role assignment UX and default-role behavior are product decisions (current product decision: user registration is admin-only).

---

8) DO NOT START YET: BUSINESS MODULE GATE

DO NOT START Business Modules until CORE PLATFORM GATE passes (CORE-01 final audit).

Business modules blocked:
- Sales
- Procurement
- Inventory
- Finance
- CRM
- Manufacturing

The gate is opened only when CORE-01 is COMPLETE (evidence-backed and validated).

---

9) MANDATORY ROADMAP UPDATE WORKFLOW (for AI sessions)

Every Copilot implementation session must follow this roadmap maintenance process:

START:
1. Read this roadmap (docs/00-overview/03-implementation-roadmap.md).
2. Read CURRENT IMPLEMENTATION CHECKPOINT.
3. Identify the exact current step (the step marked as IMMEDIATE NEXT IMPLEMENTATION STEP).
4. Confirm the intended next action with the user if the step is ambiguous or requires product/governance decisions.

DURING:
5. Implement only the current step.
6. Add/update tests for the changed behavior.
7. Run validations described in the step's validation requirement.

END:
8. Update this roadmap with: evidence, commit SHA, updated status, validation results, blockers, and the IMMEDIATE NEXT IMPLEMENTATION STEP.
9. If validation failed, mark the step IN PROGRESS or BLOCKED with failure evidence.
10. Do not proceed to the next step until the current step is validated and the roadmap updated.

---

10) EVIDENCE REQUIREMENT (How to record completed steps)

For every COMPLETED step record:
- Implementation files (paths)
- Tests added/updated (paths)
- Validation commands run
- Validation results (pass/fail and key output)
- Commit SHA implementing the step
- Security/architecture notes (e.g., tenant/RLS considerations)

Example entry (format to use):

[COMPLETED] CORE-01.05 Location selection

Files:
- frontend/lib/core/auth/auth_service.dart
- frontend/lib/modules/auth/location_selection_screen.dart

Tests:
- frontend/test/slice3_integration_test.dart

Validation:
- flutter analyze: PASS
- flutter test: PASS

Commit:
- 08cccf7

Notes:
- Backend remains authoritative for location authorization.

---

11) IMPLEMENTATION HISTORY (append-only)

- 2026-08-22
  - CORE-01 frontend authentication/context flow
  - Commit: 08cccf7
  - Summary: Implemented login, session restore, tenant/organization/location selection, active-location context, router guards, and frontend regression tests.
  - Status: recorded; partial CORE-01 completion (subitems implemented). Evidence: frontend files and tests, backend routes.

- 2026-08-20
  - Roadmap snapshot generation: ded0b71ad...

(continue appending future entries here)

---

12) IMMEDIATE NEXT IMPLEMENTATION STEP (exactly one)

AUTH-02.01 — Inspect and map the actual backend RBAC contracts to the frontend authorization architecture.

Deliverable:
- A short mapping document (file in repo under docs/ or .ai/generated/) that lists the exact backend endpoints, payload shapes, headers required, expected success and error responses, and the frontend service methods to call. Also specify the initial set of frontend UI screens to implement and the minimal set of tests.

Rationale:
- Backend RBAC is implemented and ready but frontend authorization architecture must be designed and mapped before implementation. This mapping avoids assumptions and prevents accidental backend contract mismatches.

Do not implement AUTH-02.02 until AUTH-02.01 mapping is completed and reviewed.

---

13) FILES MODIFIED / TO BE MODIFIED

This roadmap update is documentation-only. Implementation files are not modified in this change. When implementing AUTH-02, the following frontend paths are expected to be modified or created:
- frontend/lib/core/authz_service.dart (new)
- frontend/lib/modules/rbac/roles_list_screen.dart (new)
- frontend/lib/modules/rbac/role_edit_screen.dart (new)
- frontend/lib/modules/rbac/permission_catalog_screen.dart (new)
- frontend/test/authz_widget_test.dart (new)

Do not create these files now; this is the planned mapping.

---

14) FINAL VALIDATION (post-update checks)

Run locally (or CI) after editing this roadmap:
- git diff --check
- git status --short --untracked-files=all

Only documentation/workflow files are expected to change in this task.

---

ROADMAP SUMMARY (quick view)

- CORE-01 status: PARTIALLY COMPLETE
- Completed: authentication & session restoration (frontend+backend), tenant/context handling, selection flows, active-location propagation, routing guards, backend RBAC foundation
- Remaining: frontend authorization state + UI (AUTH-02), E2E validation, backend integration finalization, security audit
- Immediate next step: AUTH-02.01 — map RBAC backend contracts to frontend authorization service
- Business modules: DO NOT START until CORE-01 final audit passes

---

If a governance or product decision is required to proceed, stop and request the decision rather than invent it.


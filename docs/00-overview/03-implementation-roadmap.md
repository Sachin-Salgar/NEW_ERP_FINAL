# Implementation Roadmap

This implementation roadmap is derived from the authoritative repository documentation in docs/ and the current repository implementation. It is intended to be the single canonical place for a future AI agent or developer to determine the next implementation slice and how to resume development.

Commit SHA (evidence snapshot): ded0b71ad84795dc5aaac65f9d3d0491d47d7e00
Generated: 2026-08-20T18:30:34+05:30

---

Status legend (explicit):
- NOT STARTED
- PLANNED
- IN PROGRESS
- BACKEND COMPLETE
- FRONTEND IN PROGRESS
- TESTING
- COMPLETE
- BLOCKED
- NEEDS HUMAN DECISION


## Persistent implementation-status table

For each slice the table records evidence and the current status.

1) Slice ID: AUTH-01
   - Slice name: Authentication (register / login / refresh / logout / session lifecycle)
   - Documentation references:
     - docs/06-security/README.md
     - docs/04-backend/07-authentication-and-authorization.md
     - docs/02-architecture/02-system-architecture.md
   - Scope:
     - Backend authentication services and JWT lifecycle, session records, refresh handling, session invalidation.
     - Secure password handling, token creation/verification.
     - Integration points: registrationService, authService, jwtTokenService, session records.
   - Dependencies:
     - Database schema & platform repository (Postgres)
     - Platform bootstrap/reference data
     - Tenant context (header or request body)
   - Database status: SCHEMA & supporting tables exist (repository contains PostgresPlatformRepository and tests exercising DB usage). (See src/infrastructure/database and tests/integration)
   - Backend status: BACKEND COMPLETE (routes implemented in src/presentation/http/routes/auth.ts; domain contracts and services referenced under src/application and src/infrastructure)
   - Frontend status: NOT STARTED (no customer-facing frontend code for this slice found in the repository)
   - Test status: INTEGRATION TESTS EXIST (tests/integration/authentication-flow.test.ts). Tests are present in repo but were not executed as part of creating this roadmap.
   - Build/typecheck status: Not executed here. Project contains TypeScript sources and config (tsconfig.json).
   - E2E/user workflow status: Not implemented for frontend; backend endpoints support API flow but end-to-end UX validation remains to be executed when frontend exists.
   - Overall status: BACKEND COMPLETE (VALIDATION ARTIFACTS PRESENT — tests exist but not executed here)
   - Commit SHA: ded0b71ad84795dc5aaac65f9d3d0491d47d7e00
   - Completion date: N/A (not marked complete because frontend + UX validation missing)
   - Remaining work:
     - Implement frontend screens and UX for register/login/forgot-password/refresh/logout according to docs/05-frontend.
     - Run CI/integration tests in a reproducible environment and report results.
     - Add/validate E2E tests covering the user workflow (frontend -> backend).
   - Notes/blockers:
     - Frontend technology per docs is Flutter; no frontend code exists in repo. Need design/UI assets and product decisions for exact UX flows.

2) Slice ID: AUTH-02
   - Slice name: Authorization (RBAC, permissions, roles, effective permissions)
   - Documentation references:
     - docs/08-business-modules/02-core-enterprise-modules.md
     - docs/04-backend/07-authentication-and-authorization.md
     - docs/06-security/README.md
   - Scope:
     - Role and permission model, role management, permission assignment, effective-permissions evaluation.
     - Enforcement of permission checks at backend endpoints (requirePermission middleware).
   - Dependencies:
     - AUTH-01 (authentication/session context)
     - Database & core enterprise module data
   - Database status: Repositories and DB usage exist (see src/infrastructure/database and related repository implementations).
   - Backend status: BACKEND COMPLETE (routes in src/presentation/http/routes/rbac.ts; middleware and authorizationService referenced)
   - Frontend status: NOT STARTED
   - Test status: INTEGRATION TESTS EXIST (tests/integration/authorization-flow.test.ts). Tests are present but were not executed here.
   - Build/typecheck status: Not executed here.
   - E2E/user workflow status: Frontend UX not implemented; backend behavior is available for API-driven frontends.
   - Overall status: BACKEND COMPLETE
   - Commit SHA: ded0b71ad84795dc5aaac65f9d3d0491d47d7e00
   - Completion date: N/A
   - Remaining work:
     - Frontend role/permission management UI and integration with authentication flows.
     - Additional E2E tests and CI execution.
   - Notes/blockers:
     - No frontend; certain UX/consent flows (role assignment UX) require product decisions.

3) Slice ID: CORE-01
   - Slice name: Core Enterprise (Organization / Branch / User / Role / Permission foundational features)
   - Documentation references:
     - docs/08-business-modules/02-core-enterprise-modules.md
     - docs/04-backend/README.md
     - docs/03-database/11-multi-tenancy.md
     - docs/10-adr/0006-postgresql-rls-tenancy.md
   - Scope:
     - Organization and branch management, user profile and assignment, role/permission integration, tenant-scoped administration.
   - Dependencies:
     - AUTH-01 and AUTH-02 (authentication & authorization)
     - Database / RLS (TENANCY-01)
   - Database status: Database access/repository implementations exist and tenant-RLS helpers exist (see src/infrastructure/database and src/infrastructure/database/rls.js)
   - Backend status: BACKEND COMPLETE (routes under src/presentation/http/routes/core-enterprise.ts and supporting services exist)
   - Frontend status: NOT STARTED (no UI code for organization/branch/user workflows)
   - Test status: INTEGRATION TESTS EXIST (tests/integration/core-01-organization-branch-user.test.ts). Tests present but not executed here.
   - Build/typecheck status: Not executed here.
   - E2E/user workflow status: NOT COMPLETE — frontend + UX validation missing; backend APIs support the flows required by the docs.
   - Overall status: BACKEND COMPLETE (NOT MARKED COMPLETE because frontend/user-facing UX and E2E validation are missing)
   - Commit SHA: ded0b71ad84795dc5aaac65f9d3d0491d47d7e00
   - Completion date: N/A
   - Remaining work:
     - Implement frontend screens for org/branch/user administration and integrate with auth & RBAC.
     - Execute full E2E user workflow tests (frontend + backend) and mark COMPLETE only after passing validation.
   - Notes/blockers:
     - Frontend implementation decisions (Flutter project, routing, design system) and UI assets required.

4) Slice ID: TENANCY-01
   - Slice name: Tenant Isolation / PostgreSQL RLS
   - Documentation references:
     - docs/10-adr/0006-postgresql-rls-tenancy.md
     - docs/03-database/11-multi-tenancy.md
     - docs/06-security/README.md
   - Scope:
     - Database-level tenant isolation using PostgreSQL RLS, transaction-local tenant context, tests for RLS behavior.
   - Dependencies:
     - Postgres database
     - Application tenant-context helpers
   - Database status: IMPLEMENTED (helpers in src/infrastructure/database/rls.js, tenant-context helpers in src/infrastructure/database/tenant-context.js)
   - Backend status: N/A (this is a DB-level slice but integrated with backend connection handling in tests and infrastructure)
   - Frontend status: N/A
   - Test status: INTEGRATION TESTS EXIST (tests/integration/tenant-rls.test.ts) — tests present but not executed here.
   - Overall status: BACKEND/DB COMPLETE
   - Commit SHA: ded0b71ad84795dc5aaac65f9d3d0491d47d7e00
   - Remaining work:
     - Validate RLS behavior in CI and ensure migration tooling handles RLS policy creation safely in zero-downtime migrations.
   - Notes/blockers:
     - Migration/administration pathways must follow ADR guidance (special handling for privileged roles, background jobs, and connection pools).

---

## Additional planned slices (derived from authoritative docs)

The following slices are recorded as planned placeholders derived from docs/08-business-modules. They are NOT IMPLEMENTED in the repository at time of snapshot unless explicitly marked above.

- SALES-01: Sales vertical (see docs/08-business-modules/03-sales-module-architecture.md) — NOT STARTED
- PROCUREMENT-01: Procurement vertical (see docs/08-business-modules/04-procurement-module-architecture.md) — NOT STARTED
- INVENTORY-01: Inventory vertical (see docs/08-business-modules/05-inventory-module-architecture.md) — NOT STARTED
- MANUFACTURING-01: Manufacturing vertical (see docs/08-business-modules/06-manufacturing-module-architecture.md) — NOT STARTED
- FINANCE-01: Finance vertical (see docs/08-business-modules/07-finance-module-architecture.md) — NOT STARTED
- HR-01: Human Resources (see docs/08-business-modules/08-hr-module-architecture.md) — NOT STARTED
- CRM-01: CRM vertical (see docs/08-business-modules/09-crm-module-architecture.md) — NOT STARTED
- QUALITY-01: Quality Management (see docs/08-business-modules/11-quality-management-module-architecture.md) — NOT STARTED
- ASSET-01: Asset Maintenance (see docs/08-business-modules/12-asset-maintenance-module-architecture.md) — NOT STARTED
- BI-01: BI & Analytics (see docs/08-business-modules/13-bi-analytics-module-architecture.md) — NOT STARTED
- WORKFLOW-01: Workflow / BPM (see docs/08-business-modules/14-workflow-bpm-module-architecture.md) — NOT STARTED

---

## NEXT SLICE (exactly ONE)

Based on authoritative documentation and current repository evidence, the one clear next slice is:

NEXT SLICE: CORE-01 (Frontend & E2E user workflow for Core Enterprise)

Rationale:
- The backend for CORE-01 (organization/branch/user administration) is implemented and has integration tests in the repository, but the frontend and user-facing E2E validation are not present.
- The repository's implementation strategy requires completing vertical slices end-to-end (DB → domain → backend → frontend → security → E2E) before moving to another module.
- Completing CORE-01 frontend and full user workflow will convert the existing backend work into a fully validated vertical slice and provide the UI/UX foundation needed by other modules.

High-level scope for NEXT SLICE:
- Add Flutter frontend screens for Organization List, Organization Create/Edit, Branch List/Create/Edit, User List/Create/Edit, Role assignment flows, and login/register UX per docs/05-frontend and docs/08-business-modules/02-core-enterprise-modules.md.
- Integrate frontend with /api/v1 endpoints already implemented (auth, core-enterprise, rbac).
- Implement E2E tests that exercise the full user workflow (register/login → create org → create branch → register member → assign roles/branches → permission checks).
- Run integration tests and CI validation (typecheck, lint, unit/integration tests) and report results.

---

## How to Resume Development

This section instructs a future AI agent or developer how to continue.

1. Read this roadmap first: docs/00-overview/03-implementation-roadmap.md (this file).
2. Find the first incomplete slice: look for the slice with status not COMPLETE. The recommended next slice is CORE-01 (Frontend & E2E).
3. Read that slice's authoritative documentation:
   - docs/08-business-modules/02-core-enterprise-modules.md
   - docs/05-frontend/README.md and relevant frontend UI guidelines in docs/05-frontend/
   - docs/04-backend/07-authentication-and-authorization.md (for auth integration)
   - docs/06-security/README.md (for security/tenant isolation)
4. Inspect the existing implementation evidence:
   - Backend routes: src/presentation/http/routes/core-enterprise.ts, auth.ts, rbac.ts
   - Domain contracts: src/domain/contracts/*
   - Infrastructure: src/infrastructure/database, src/infrastructure/security
   - Integration tests: tests/integration/core-01-organization-branch-user.test.ts and related auth/rbac tests
5. Follow the ERP feature-development skill flow (see .github/skills/erp-feature-development/SKILL.md) and the AI workflow in .ai/workflows/feature-development.md.
6. Implement only that slice (end-to-end):
   - If adding frontend: create the Flutter project (or use repo's frontend structure if present) following docs/05-frontend and the repository's frontend conventions.
   - Wire UI to existing API endpoints (use API_PREFIX: /api/v1).
   - Implement frontend presentation-only validation and rely on backend for authoritative checks.
7. Add automated tests:
   - Unit tests for frontend components as appropriate.
   - E2E tests that simulate user workflows (login → create org → create branch → create/assign users/roles) using a deterministic test database instance.
8. Run validations:
   - Typecheck and lint for changed code (tsc, linters if configured).
   - Run targeted integration tests (tests/integration/* that are relevant) and the new E2E tests.
   - Ensure database migrations and RLS policies are handled in migration scripts per ADR-0006.
9. Update the roadmap with evidence:
   - Record the commit SHA that implements the slice.
   - Update statuses, completion date, and notes. Attach test run commands and pass/fail outputs.
   - Mark the slice COMPLETE only after backend + frontend + E2E tests pass in CI.
10. Identify the next slice and repeat.

---

## Documentation and evidence consulted
- docs/00-overview/README.md
- docs/00-overview/02-governance.md
- docs/02-architecture/* (Core System Architecture)
- docs/03-database/* (Database architecture and multi-tenancy)
- docs/04-backend/* (Backend architecture & auth/authorization)
- docs/05-frontend/* (Frontend guidance)
- docs/06-security/* (Security architecture)
- docs/08-business-modules/* (Core Enterprise module definition)
- docs/10-adr/0006-postgresql-rls-tenancy.md (RLS ADR)

Repository evidence:
- src/presentation/http/routes/auth.ts
- src/presentation/http/routes/rbac.ts
- src/presentation/http/routes/core-enterprise.ts
- src/infrastructure/database/rls.js and tenant-context helpers
- tests/integration/authentication-flow.test.ts
- tests/integration/authorization-flow.test.ts
- tests/integration/core-01-organization-branch-user.test.ts
- tests/integration/tenant-rls.test.ts

---

If any of the remaining work items require product or governance decisions (for example, UX choices, module enablement policies, or ADR changes), stop and request that decision rather than inventing a rule.

## Product Decisions (authoritative for this roadmap)

The following product decisions are recorded and are authoritative for the current implementation and the roadmap. These decisions were made by the product/architecture authority and must be followed by any future implementation work unless an approved ADR or governance change explicitly updates them.

- Tenant creation: OPS/PLATFORM ADMINISTRATION ONLY
  - Tenant creation is an administrative/platform operation. Use the existing TenantBootstrapService and platform repository bootstrap mechanism for creating tenants. Do NOT implement public tenant signup, tenant creation UI, or a public tenant creation REST API in this roadmap slice. Any future self-service tenant onboarding must be a separate documented product decision and implementation slice.

- User registration: ADMIN-ONLY
  - User registration remains an admin-protected operation. The existing protected endpoint POST /api/v1/auth/register (requires authentication and permission 'user.manage') is authoritative. Do NOT implement anonymous or public user signup, email-verification workflows, or change default-role behavior unless later documented.

- Frontend design: FUNCTIONAL-FIRST
  - Implement a functional-first frontend following the repository frontend architecture and design-system guidance. Do not block CORE-01 on pixel-perfect external design assets. The frontend must remain presentation-only; backend validation and authorization remain authoritative.


## CORE-01 explicit status checklist

Use these explicit checkboxes so a future AI or developer can quickly determine the current state and next action.

- [x] CORE-01 backend: IMPLEMENTED
- [x] CORE-01 database / RLS: IMPLEMENTED
- [x] CORE-01 backend integration tests: PRESENT
- [x] CORE-01 frontend — Foundation: COMPLETE (scaffolded)
  - [x] Flutter foundation: COMPLETE
  - [x] API/session foundation: COMPLETE
  - [x] Authentication UI (login): COMPLETE (basic implementation)
  - [x] Application shell: COMPLETE (app bar, navigation, logout)
  - [x] Dashboard landing: COMPLETE (placeholder widgets)
- [x] CORE-01 Organization frontend: IMPLEMENTED (presentation-only)
  - [x] Organization list: IMPLEMENTED
  - [x] Organization create: IMPLEMENTED
  - [x] Organization details: IMPLEMENTED
  - [x] Organization edit: IMPLEMENTED
  - [x] Organization deactivate: IMPLEMENTED
  - Organization frontend validation: PENDING (Flutter SDK unavailable in this environment)
- [x] CORE-01 Branch frontend: IMPLEMENTED (presentation-only)
  - [x] Branch list: IMPLEMENTED
  - [x] Branch create: IMPLEMENTED
  - [x] Branch details: IMPLEMENTED
  - [x] Branch edit: IMPLEMENTED
  - [x] Branch deactivate: IMPLEMENTED
  - Branch frontend validation: PENDING (Flutter SDK unavailable in this environment)
- [x] CORE-01 User frontend: IMPLEMENTED (presentation-only)
  - [x] User list: IMPLEMENTED
  - [x] User create (admin-only): IMPLEMENTED (calls POST /api/v1/auth/register)
  - [x] User details: IMPLEMENTED
  - [x] User edit: IMPLEMENTED (PATCH /api/v1/users/:id)
  - [x] User activate/deactivate: IMPLEMENTED (POST /api/v1/users/:id/activate|deactivate)
  - [x] User organization/branch access assignment UI: IMPLEMENTED (POST /api/v1/users/:userId/organizations/:orgId/access, /branches/:branchId/access)
  - [x] User frontend tests: SCAFFOLDING ADDED (frontend/test/user_widget_test.dart)
  - User frontend validation: PENDING (Flutter SDK unavailable in this environment)
  - Implementation commit SHA: 6bb7fd869fa980174be58c573da7d2562c66964a
- [ ] CORE-01 E2E: NOT STARTED
- [ ] CORE-01 overall: IN PROGRESS

Next action: CORE-01 User frontend completed — next slice: CORE-01 E2E / validation (run flutter tooling, format, analyze, run frontend tests and end-to-end user workflow tests). Validation should be performed in a Flutter-enabled environment.

## Flutter frontend scaffold status

Search results: a Flutter frontend scaffold now exists under `frontend/` with an application entry point and core infrastructure (main.dart, app shell, routing, API client, auth service, secure storage, and dashboard placeholder).

**Flutter frontend scaffold: CREATED**

Notes:
- Files committed: frontend/ (initial scaffold commit) and a subsequent commit adding a login screen and routing.
- Flutter SDK was not available in the current environment; therefore formatting, analyzer, and test execution were NOT run here. Validation is pending in an environment with Flutter tooling.


## Current Resume Point

This section is the canonical resume marker for future AI sessions and must remain highly visible near the top of the roadmap.

**CURRENT RESUME POINT**

- Current slice: CORE-01
- Backend: COMPLETE / IMPLEMENTED
- Database / RLS: COMPLETE / IMPLEMENTED
- Backend integration tests: PRESENT
- Frontend: FOUNDATION IMPLEMENTED (scaffold + login + app shell)
- E2E: NOT STARTED
- Tenant creation: OPS-ONLY
- User registration: ADMIN-ONLY
- Next action: IMPLEMENT CORE-01 Organization frontend (Phase E: Organization UI)
- Do not start other business modules until CORE-01 frontend + E2E is complete.


---


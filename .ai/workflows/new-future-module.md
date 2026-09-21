# New and Future Module Implementation Workflow

## Purpose

Mandatory AI implementation workflow for every new business module, major module expansion, or newly exposed module capability in NEW_ERP_FINAL.

The authoritative architecture remains in `docs/`, approved ADRs, and affected module specifications.

## 1. Read authority before coding

Start with:
1. `docs/README.md`
2. `docs/00-overview/02-governance.md`
3. `.ai/repository-map.md`
4. `.ai/authority.md`
5. Relevant business-module, platform-service, frontend, backend, security and database documents.
6. Relevant approved ADRs.

For workflow-enabled functionality also read `.ai/workflows/canonical-workflow-bpm.md`, `docs/08-business-modules/14-workflow-bpm-module-architecture.md`, and `docs/10-adr/0043-workflow-bpm-engine.md`.

If authoritative documents conflict, stop and surface the conflict. Do not guess.

## 2. Define the module boundary

Before coding, identify:
- stable module code/name and business responsibility;
- owned entities, state and invariants;
- lifecycle states and fixed transitions;
- configurable approval/process decisions;
- permissions;
- tenant entitlement;
- branch/RLS requirements;
- audit requirements;
- dependencies;
- API and frontend routes;
- migration/data requirements.

The module owns its business state and invariants. Other modules must use approved contracts/platform mechanisms rather than directly mutating private tables.

## 3. Tenant entitlement is mandatory

Repository implementation does not imply tenant enablement.

The runtime authority is:
`tenant_modules -> modules`

Every optional module must:
1. have one canonical `modules` catalog row;
2. use `tenant_modules` for tenant-specific enablement;
3. expose state through the existing module-access service;
4. enforce entitlement in backend authorization;
5. filter frontend navigation from authenticated tenant module state.

Never remove module checks or hard-code frontend visibility.

Module enablement must be idempotent and must **create the `tenant_modules` row when it is missing**. Do not implement enablement as UPDATE-only.

Do not blindly enable optional modules for all tenants or use ad-hoc production SQL when an approved provisioning path exists.

## 4. Permissions are separate

For every capability:
- define canonical permission keys;
- register/seed them through the existing permission mechanism;
- assign them through the existing role model;
- enforce them in backend routes/services;
- enforce them in frontend navigation/actions.

Module entitlement does not replace user authorization.

## 5. Use the canonical Workflow/BPM engine

For configurable approval/process orchestration:
- use the single canonical Workflow/BPM engine;
- keep business state and invariants in the module;
- register explicit module decision handlers;
- return workflow outcomes through module application services.

Never create a module-local approval engine, second workflow repository, approval-matrix engine, duplicate human-task model, or direct workflow writes into module-owned tables.

Fixed domain transitions remain module-owned when they are not configurable workflow decisions.

## 6. Backend implementation order

Implement and validate:
1. domain state/invariants;
2. application services;
3. repository contracts/implementation;
4. migrations;
5. tenant/branch/RLS;
6. authorization;
7. audit/idempotency/concurrency;
8. API schemas/routes;
9. workflow adapter/decision handler where required.

Do not expose an API before its entitlement and authorization behavior are defined.

## 7. Frontend discoverability

Every user-facing capability must be reachable through canonical navigation:
- route metadata;
- canonical module code;
- required permission;
- sidebar/navigation entry;
- deep link;
- route guard.

Do not create a second navigation or authorization mechanism.

A backend feature is not complete if intended users cannot discover and reach it.

## 8. Provisioning verification

Verify:
- exactly one canonical module catalog entry;
- correct `is_core`, group, sort order and metadata;
- new tenants receive the intended default modules;
- optional modules are not implicitly enabled unless explicitly required;
- enabling an optional module creates a missing entitlement row;
- disabling preserves entitlement history/metadata;
- intended roles receive permissions;
- users without module entitlement cannot use the capability even if they have a permission.

## 9. Required tests

Add/update:
- unit tests for invariants, services, authorization and idempotent entitlement changes;
- PostgreSQL integration tests for tenant isolation, RLS, provisioning, missing-entitlement creation, authorization and transaction behavior;
- workflow tests when applicable;
- frontend route, module-aware navigation, permission-aware navigation, deep-link and guard tests.

## 10. Migration/deployment safety

Before merge:
- verify migration ordering and idempotency;
- inspect destructive changes;
- preserve RLS and application-role security;
- verify clean-database and existing-tenant provisioning behavior;
- do not weaken production security to make tests pass;
- verify production configuration assumptions.

Never assume production entitlement state matches test data.

## 11. Completion checklist

- [ ] authoritative architecture/specification reviewed
- [ ] module boundary and invariants defined
- [ ] canonical `modules` entry exists
- [ ] `tenant_modules` provisioning implemented
- [ ] module enablement is idempotent and creates missing rows
- [ ] permissions registered and role assignment verified
- [ ] backend entitlement and authorization enforced
- [ ] frontend routes and sidebar navigation added
- [ ] deep links and guards work
- [ ] canonical Workflow/BPM used where required
- [ ] no duplicate workflow/approval engine introduced
- [ ] audit/idempotency/concurrency considered
- [ ] tenant/branch/RLS tests pass
- [ ] backend tests pass
- [ ] frontend tests/formatting pass
- [ ] PostgreSQL integration tests pass
- [ ] AI workflow validation passes
- [ ] deployment checks pass
- [ ] roadmap/documentation updated with evidence
- [ ] all required CI checks green before merge

## Final rule

A module is complete only when:

`Architecture + Domain + Persistence + Entitlement + Authorization + API + Workflow (if applicable) + UI Navigation + Tests + Deployment + Documentation`

Tenant entitlement is product architecture, not an optional deployment detail.


## Identity, user account, and employee access boundary

When a module introduces people, workforce records, or ERP access, keep the concepts separate:

- **Identity** represents the authenticated person/account across contexts.
- **Tenant membership** grants that identity access to a tenant and is required for tenant context.
- **User account** represents the tenant-scoped ERP account used by existing authorization and application records.
- **Employee/person records** belong to the HR domain when that domain is implemented; they are not a second authentication system.

Creating an ERP user must provision the tenant user account and its tenant membership atomically. Login identifiers and credentials must remain bound to the same identity. Granting ERP access to an employee must be an explicit authorization operation; an HR employee record must not automatically imply ERP access.

Do not create a parallel employee-login, member-login, or module-specific user table. When the HR Employee master is implemented, it must reference the canonical identity/access model rather than duplicating authentication data.

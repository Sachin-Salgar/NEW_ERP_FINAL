# Implementation Roadmap

**Status:** Living implementation roadmap  
**Authority:** This document records implementation status and planned sequence. Architecture documents and Approved ADRs define what the system is supposed to be; this roadmap records what is actually implemented and what remains to be validated or built.

**Last reconciled:** 2026-08-28  
**Baseline:** `main` at `c561715f5f5387b5706dec0e434cf879c218e694`

## Status definitions

- **COMPLETED** — implementation exists and the available repository/CI evidence supports completion for the stated scope.
- **IMPLEMENTED — VALIDATION PENDING** — code/UI exists, but required end-to-end, security, or operational validation is not yet complete.
- **PARTIAL** — meaningful implementation exists, but material capability remains incomplete.
- **PENDING** — not implemented in the current repository.
- **BLOCKED** — implementation/validation cannot currently proceed because of a known external or tooling blocker.
- **DEFERRED** — intentionally outside the current implementation sequence.

## 1. Authoritative architecture baseline

The current architecture is a **layered modular monolith** with Flutter clients, a REST API, backend application/business services, repositories/data access, and PostgreSQL. The backend is one deployable application with logical module boundaries. fileciteturn13file0

Tenant identity is governed by **ADR-0006: Identity-Based Tenant Context and PostgreSQL RLS**. Tenant identity is discovered from the authenticated user identity through the deployment-independent login lookup; deployment hostname, frontend URL, client-supplied tenant ID, and deployment configuration are not tenant authorities. fileciteturn16file0

PostgreSQL RLS remains the database isolation boundary, with tenant context established transaction-locally from trusted server-side tenant context. fileciteturn20file0

**The old host/deployment TenantResolver roadmap is retired. It is not a current implementation target.** The current code contains identity-based authentication and tenant-context infrastructure instead. fileciteturn24file0

## 2. Current checkpoint

**Current phase:** Core Enterprise foundation — implementation complete for the principal authentication/RBAC/admin surfaces; final cross-layer validation and security gates remain.  

**Current state:**

- Production Flutter Web login is working against the deployed backend/database.
- Identity-based tenant discovery is implemented in authentication.
- Tenant-scoped sessions and server-side tenant context are implemented.
- PostgreSQL RLS/transaction-local tenant context infrastructure and tests exist.
- Organization, branch/location, and user administration backend/API surfaces exist.
- Flutter organization, branch, user, role, permission, dashboard, and authentication surfaces exist.
- Backend RBAC and permission enforcement exist.
- Flutter permission state, permission-aware navigation/route guards, and role/permission/user-role administration surfaces exist.
- Full business-module implementation has **not** started.

**Next gate:** complete the remaining Core Enterprise validation/security audit, then open business-module implementation in the documented order.

## 3. Tenancy, identity and authentication

| Area | Status | Current implementation / remaining work |
|---|---|---|
| Tenant data boundary | **COMPLETED** | Tenant-scoped data model and PostgreSQL RLS architecture are implemented. |
| Identity-based tenant discovery | **IMPLEMENTED — VALIDATION PENDING** | `AuthenticationService` uses deployment-independent login candidates, verifies tenant-scoped user credentials, and fails closed on ambiguous active matches. fileciteturn24file0 |
| Tenant-scoped session | **IMPLEMENTED — VALIDATION PENDING** | Session records carry tenant/user/organization/location context and access/refresh token lifecycle. |
| TenantContext | **IMPLEMENTED — VALIDATION PENDING** | Server derives request tenant from authenticated session; database helper establishes transaction-local tenant context. fileciteturn28file0turn38file0 |
| PostgreSQL RLS | **COMPLETED** | RLS helper and integration coverage prove tenant visibility, write isolation, rollback behavior, and connection-pool context isolation for the tested tenant table. fileciteturn47file0 |
| Legacy host/deployment TenantResolver | **DEFERRED / RETIRED** | Not part of the current architecture. Do not reintroduce SaaS/on-prem host resolver strategies. ADR-0006 explicitly replaces that model. fileciteturn16file0 |
| Login/session frontend | **IMPLEMENTED — VALIDATION PENDING** | Flutter authentication and session restoration are implemented; deployed login is working. Full browser E2E remains a validation gate. |
| SaaS/on-prem/mobile tenancy verification | **PENDING** | Architecture is deployment-independent, but the required cross-deployment verification scenarios are not yet evidenced in the repository. |
| Ambiguous multi-tenant credential verification | **IMPLEMENTED** | Unit test covers fail-closed behavior when the same credentials match multiple active tenant accounts. fileciteturn48file0 |

## 4. Core Enterprise

The authoritative Core Enterprise architecture covers organization, branch/location, user/identity, roles, permissions, RBAC, module enablement, and access boundaries. fileciteturn35file0

| Capability | Status | Evidence / remaining work |
|---|---|---|
| Authentication | **IMPLEMENTED — VALIDATION PENDING** | Backend authentication service, Flutter login, token/session handling; deployed login verified. |
| Session management / refresh / logout | **IMPLEMENTED — VALIDATION PENDING** | Session service/authentication service and Flutter session lifecycle exist; full E2E lifecycle still needs evidence. |
| Organization selection | **IMPLEMENTED — VALIDATION PENDING** | Backend organization access/select flow and Flutter organization selection are implemented. |
| Location/branch selection | **IMPLEMENTED — VALIDATION PENDING** | Backend location access/list/select flow and Flutter location selection are implemented. |
| Active organization/location context | **IMPLEMENTED — VALIDATION PENDING** | Session/request context supports organization and active location; cross-layer validation remains. |
| Organization administration | **IMPLEMENTED — VALIDATION PENDING** | Backend create/list/get/update/deactivate operations exist in `CoreEnterpriseRepository`; Flutter organization module exists. fileciteturn25file0 |
| Branch administration | **IMPLEMENTED — VALIDATION PENDING** | Backend branch CRUD/lifecycle operations exist; Flutter branch module exists. fileciteturn25file0turn26file0 |
| User administration | **IMPLEMENTED — VALIDATION PENDING** | Backend user administration and organization/branch assignment operations exist; Flutter user list/create/edit/details/access surfaces exist. fileciteturn25file0turn49file0 |
| User → role assignment | **IMPLEMENTED — VALIDATION PENDING** | Backend POST/DELETE role assignment endpoints and dedicated Flutter user-role assignment screen exist. fileciteturn27file0turn49file0 |
| Backend RBAC | **COMPLETED** | Roles, permissions, role-permission assignment, user-role assignment, effective-permission evaluation, and permission middleware are implemented. fileciteturn27file0turn28file0 |
| Role management UI | **IMPLEMENTED — VALIDATION PENDING** | Flutter role module and role tests exist; backend role CRUD is implemented. |
| Permission catalog UI | **IMPLEMENTED — VALIDATION PENDING** | Flutter permission module exists; backend permission listing is permission-gated. |
| Role → permission assignment UI | **IMPLEMENTED — VALIDATION PENDING** | Backend assignment/removal endpoints and Flutter role/permission surfaces exist. |
| Frontend authorization state | **IMPLEMENTED — VALIDATION PENDING** | Flutter AuthZ tests and authorization state implementation exist. |
| Permission-aware navigation | **IMPLEMENTED — VALIDATION PENDING** | Navigation visibility is permission-aware; backend remains authoritative. |
| Permission-aware route guards | **IMPLEMENTED — VALIDATION PENDING** | Flutter routing guards exist; they are UX controls, not the security boundary. |
| Module enablement/licensing | **IMPLEMENTED — VALIDATION PENDING** | Backend `ModuleAccessService` and authorization middleware enforce module enablement separately from user permissions. fileciteturn28file0 |
| Core frontend/backend E2E | **BLOCKED / PENDING VALIDATION** | E2E test files exist, but the known Flutter Web runner issue has not yet produced authoritative end-to-end evidence. fileciteturn45file0 |

## 5. Platform foundation

The platform architecture defines shared capabilities including authentication, authorization, audit, notifications, file storage, configuration, scheduler, reporting, integration, AI, localization, and related platform infrastructure. fileciteturn32file0

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

These are intentionally listed as pending where the current repository does not contain a corresponding completed platform implementation. Architecture documentation alone is not treated as implementation evidence.

## 6. Database, quality and operational foundation

| Area | Status | Notes |
|---|---|---|
| PostgreSQL/Drizzle database layer | **IMPLEMENTED — VALIDATION PENDING** | Current database schema, repositories, migrations, connection and RLS infrastructure exist. |
| Migration system | **IMPLEMENTED** | Migration runner and migration set exist; production deployment must continue to use migrations. |
| Tenant RLS integration tests | **COMPLETED** | Current integration test proves transaction-local context and tenant isolation behavior for the tested RLS table. fileciteturn47file0 |
| Backend unit/integration CI | **IMPLEMENTED** | PostgreSQL CI workflow exists and the latest repository history contains successful CI runs. fileciteturn39file0turn40file0 |
| Flutter unit/widget tests | **IMPLEMENTED — VALIDATION PENDING** | Auth/AuthZ, role, user and permission-related tests are present. fileciteturn44file0 |
| Flutter frontend→backend E2E | **BLOCKED / PENDING VALIDATION** | E2E scenarios are present, but runner evidence remains incomplete. |
| Security audit against authoritative security architecture | **PENDING** | Must verify secure token handling, authorization, tenant context, RLS, audit requirements, secrets/logging and fail-closed behavior before business-module gate opens. |
| CORE final completion audit | **PENDING** | Required after E2E and security validation. |
| Production deployment validation | **IMPLEMENTED — VALIDATION PENDING** | Vercel → Render backend → Render PostgreSQL is operational and deployed login works; broader release validation remains. |

## 7. Business modules — implementation queue

The business-module architecture currently defines the following active modules. Project Management is explicitly removed/deferred and is **not** an implementation target. fileciteturn34file0

| Sequence | Module | Status | Current position |
|---|---|---|---|
| 1 | Core Enterprise | **IMPLEMENTED — VALIDATION PENDING** | Current platform foundation; final E2E/security gate remains. |
| 2 | Sales | **PENDING** | No current Sales business implementation verified in repository. |
| 3 | Procurement | **PENDING** | No current Procurement business implementation verified in repository. |
| 4 | Inventory | **PENDING** | No current Inventory business implementation verified in repository. |
| 5 | Manufacturing | **PENDING** | No current Manufacturing business implementation verified in repository. |
| 6 | Finance | **PENDING** | No current Finance business implementation verified in repository. |
| 7 | Human Resources | **PENDING** | No current HR business implementation verified in repository. |
| 8 | CRM | **PENDING** | No current CRM business implementation verified in repository. |
| 9 | Quality Management | **PENDING** | No current Quality Management business implementation verified in repository. |
| 10 | Asset Maintenance | **PENDING** | No current Asset Maintenance business implementation verified in repository. |
| 11 | BI & Analytics | **PENDING** | No current BI/Analytics business implementation verified in repository. |
| 12 | Workflow / BPM | **PENDING** | Architecture exists; no current business implementation verified in repository. |

Business modules must not be started until the Core Enterprise gate is completed unless an approved architectural decision changes the sequence. Each module must first use its authoritative module specification, then implement its own vertical slice with backend rules, data ownership, authorization, tests, and required Flutter UI.

## 8. Required validation before opening business modules

1. Complete the first real Flutter → backend E2E scenario:
   - login;
   - identity-based tenant establishment;
   - organization selection;
   - location selection where applicable;
   - permission-aware navigation;
   - backend authorization enforcement.
2. Resolve or explicitly bound the Flutter Web E2E runner problem with authoritative evidence.
3. Validate tenant isolation across representative tenant-owned operations, including transaction and pooled-connection safety.
4. Complete the security audit against the authoritative security architecture and ADR-0006.
5. Complete the Core Enterprise implementation audit.
6. Only then open Sales as the first business-module implementation slice.

## 9. Development rules for future roadmap updates

- Inspect the current repository before changing a status.
- Do not infer implementation from architecture documentation alone.
- Do not mark a capability completed merely because a screen, service stub, or specification exists.
- Do not resurrect the retired host/deployment TenantResolver architecture.
- Identity-based tenant context is the canonical tenancy model unless superseded by an approved ADR. fileciteturn16file0
- Frontend permission visibility and route guards never replace backend authorization. fileciteturn28file0
- PostgreSQL RLS remains mandatory for tenant-owned data. fileciteturn20file0
- Do not create a second roadmap document.
- When implementation materially changes architecture, update the affected authoritative architecture/ADR documentation as required by the documentation principle. fileciteturn14file0

## 10. Reconciliation summary

The previous roadmap contained historical TenantResolver strategy work, contradictory Core Enterprise statuses, and stale checkpoint/commit information. This version removes the obsolete resolver sequence, consolidates Core Enterprise into capability-level status, preserves every current core capability and pending platform/business area, and makes validation gates explicit.

The roadmap now reflects the current repository direction:

```text
Identity-based authentication
        ↓
Tenant-scoped session
        ↓
TenantContext
        ↓
Organization / Location authorization
        ↓
RBAC + module enablement
        ↓
Core Enterprise validation/security gate
        ↓
Sales
        ↓
Procurement
        ↓
Inventory
        ↓
Manufacturing
        ↓
Finance
        ↓
HR / CRM / Quality / Assets / BI / Workflow
```

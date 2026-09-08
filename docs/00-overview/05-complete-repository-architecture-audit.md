# Complete Repository Architecture and Identity Audit

**Date:** 2026-09-08  
**Scope:** Repository architecture, governance guidance, authentication and identity,
tenant/platform context, authorization, PostgreSQL/RLS, Flutter, seed data, and
validation.

**Document status:** Historical audit snapshot. Its residue findings describe the
repository state at the time of the audit and are not current implementation guidance.

## Executive summary

**Overall status: RED — authoritative guidance required cleanup and implementation
residue remains.**

The current architecture is:

```text
Platform
  └── Tenant
       ├── Branch
       │    ├── Users
       │    ├── Roles
       │    └── Data
       └── Branch
            ├── Users
            ├── Roles
            └── Data
```

Platform administration is separate from normal tenant application access. Tenant is
the security, authorization, data-isolation, and PostgreSQL RLS boundary. A normal
application user belongs to exactly one tenant and normal login establishes that
tenant automatically. Branch is the only business subdivision below Tenant and is not
an independent security or RLS boundary. Organisation/Organization and Location are
not architecture hierarchy, membership, authorization, working-context, or login
levels.

## Authority corrections

The following current-facing contradictions were corrected in this documentation
cleanup:

| Area | Finding | Classification | Required action |
|---|---|---|---|
| ADR-0006 | Approved ADR described tenant discovery, candidate accounts, and organization/location context | HISTORICAL / SUPERSEDED | Marked Superseded by ADR-0040 and retained as historical rationale |
| Implementation roadmap | Reported identity-wide membership discovery and context selection as current implementation direction | CONTRADICTION | Rewritten for automatic single-tenant login and deferred residue |
| Prior audit content | Presented ADR-0040 multi-membership/context selection as current architecture | CONTRADICTION | Rewritten to separate current architecture from residue |
| Copilot instructions | Directed agents to implement Organization/Location working context and organization switching | CONTRADICTION | Rewritten for Platform → Tenant → Branch |
| `.ai` navigation | Directed agents to read superseded ADRs as applicable current guidance | CONTRADICTION | Superseded ADRs are historical-only references |

## ADR status and governance

ADR-0040 is the current approved authority for platform administration, tenant
identity, authentication context, sessions, permissions, RLS, and deployment. ADR-0006,
ADR-0011, and ADR-0012 are superseded and remain only for historical traceability.
The ADR index is authoritative for status and must remain consistent with each ADR's
status field.

## Implementation residue — deferred

This audit intentionally did not modify implementation. The following findings remain
for a separate governed migration task:

| Area | Evidence | Classification |
|---|---|---|
| Backend authentication | `/auth/login` discovery behavior, discovery tokens, `/auth/context`, and platform/tenant membership exchange | IMPLEMENTATION RESIDUE — DEFERRED |
| JWT/session contracts | discovery context types and context-related session fields | IMPLEMENTATION RESIDUE — DEFERRED |
| Flutter authentication | context-selection state, screen, routes, and organization/location session state | IMPLEMENTATION RESIDUE — DEFERRED |
| Backend/domain services | organization/location services and context-select routes | IMPLEMENTATION RESIDUE — DEFERRED |
| Database | identity/membership tables, organization/location tables, and related session/default fields | IMPLEMENTATION RESIDUE — DEFERRED; no migration decision made |
| Tests and fixtures | multi-membership, context-selection, organization/location selection, and platform/tenant exchange scenarios | IMPLEMENTATION RESIDUE — DEFERRED |
| Seed data | multi-organization/location custom and E2E fixtures | IMPLEMENTATION RESIDUE — DEFERRED |

No database objects, API routes, authentication code, frontend routing, tests, seed
scripts, or CI configuration were removed or changed by this documentation pass.

## Legitimate terminology retained

Occurrences of organization/organisation and location remain where they describe
ordinary business data, addresses, warehouses, inventory locations, external
integrations, or historical ADR rationale. Search hits alone are not architecture
contradictions and must be classified by meaning before any implementation cleanup.

## Documentation alignment matrix

| Area | Current authority result | Status |
|---|---|---|
| Core architecture | Platform → Tenant → Branch; tenant is the RLS boundary | ALIGNED |
| ADR index | ADR-0040 Approved; ADR-0006/0011/0012 Superseded | ALIGNED |
| `.ai` guidance | Single-tenant normal login; no tenant switching or organization/location architecture | ALIGNED |
| Copilot instructions | Same canonical model and explicit prohibited flows | ALIGNED |
| Roadmap | Current work is residue reconciliation, not context-selection architecture | ALIGNED |
| Source and database | Existing superseded model remains | NOT CONFORMANT — DEFERRED |

## Recommended next phase

1. Obtain review/approval of this authority cleanup.
2. Prepare a governed implementation and migration decision for authentication,
   database, frontend, tests, and fixtures.
3. Remove or migrate implementation residue only under that approved decision.
4. Re-run backend, RLS, security, Flutter, integration, and browser validation.

## Safety boundary

This document is an audit and authority record, not an implementation plan that
authorizes source changes. The repository remains **documentation-aligned but not
implementation-conformant** until the deferred migration is separately approved and
validated.

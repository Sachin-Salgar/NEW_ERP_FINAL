# AI Authority Contract

## Purpose

Define which repository information an AI coding assistant may rely on when understanding or changing NEW_ERP_FINAL.

## Authority hierarchy

Use the repository's governance hierarchy exactly as defined by `docs/00-overview/02-governance.md`:

1. **Software Architecture Document (SAD)** — baseline architectural guidance.
2. **Approved ADRs** — supersede affected SAD decisions within their explicit scope.
3. **Development Standards** — implementation standards that operationalize architecture.
4. **Module Specifications** — module-specific application of the higher-level rules.
5. **Source code and tests** — evidence of current implementation, not architectural authority.
6. **AI inference** — lowest authority and never sufficient to override repository evidence.

## Current Tenancy Authority

`docs/10-adr/0006-identity-based-tenant-context.md` is the approved architectural authority for authentication, tenant context, tenant isolation, SaaS/on-premises deployment behavior, and web/mobile tenancy flow.

For tenancy-related work, the canonical security lifecycle is:

```text
Authenticated Identity
  ↓
Tenant Membership
  ↓
Active Tenant
  ↓
Tenant-scoped Session
  ↓
TenantContext
  ↓
Working Context: Organisation → Location
  ↓
Authorization
  ↓
Tenant Transaction
  ↓
SET LOCAL app.current_tenant_id
  ↓
PostgreSQL RLS
```

The tenant is established by authenticated identity and remains fixed for the session. Organisation and location are post-login working context within that tenant.

### Authentication / working-context UX contract

- The configured API URL is connectivity configuration only and is never tenant authority.
- Successful login goes directly to Dashboard.
- The user's configured default organisation and default location are applied when available.
- Missing defaults do not block login and do not cause a selection-screen gate.
- Organisation and location are switched from the authenticated Profile / Working Context menu.
- No standalone organisation-selection or location-selection screen is part of the login flow.
- Switching organisation reloads authorized locations and effective permissions for the new organisation.
- A selected location must belong to / be authorized within the active organisation.
- Working-context changes can never change the authenticated tenant.
- Web and mobile clients connect to the configured ERP backend endpoint and never directly to PostgreSQL.

Deployment URL/API endpoint is connectivity configuration only. Hostname, custom domain, deployment configuration, or client-supplied tenant identifiers must not be treated as authoritative tenant identity.

## Document status

- `Approved` ADR: authoritative for its stated scope.
- `Proposed` ADR: not an implementation authority.
- `Superseded` ADR: not authoritative; follow its replacement.
- `Deprecated` ADR: not authoritative for new implementation.
- `docs/archive/`: historical/reference material; do not treat its contents as current authority unless a current authoritative document explicitly directs its use.

## Conflict rules

### Architecture vs code

If authoritative documentation conflicts with source code, treat the source code as non-conforming implementation. Do not silently change the documentation to match the code.

### SAD vs ADR

An approved ADR wins only for the decision and scope it explicitly addresses. It does not globally invalidate unrelated SAD requirements.

### Standards vs architecture

Development standards clarify how to implement architecture. They may not silently contradict higher-level architectural decisions.

### Missing decision

If a feature requires a decision that the authoritative documentation does not establish, do not invent it. Report the missing decision and stop at the decision boundary.

### Contradictory documents

If two apparently authoritative documents conflict and the conflict cannot be resolved from an approved ADR or governance rule, stop and report the conflict. Do not select one by preference.

## Database infrastructure rule

Database infrastructure is developer-owned. AI agents must never create, modify, delete, replace, or provision PostgreSQL databases, PostgreSQL users, or PostgreSQL roles. AI agents must never invent database credentials or connection strings. AI agents must use the project's documented environment configuration and must fail clearly when the configured database is unavailable.

A database connection failure is NOT permission to create another database, create another user, change credentials, or switch to Docker PostgreSQL.

## AI evidence requirements

For every non-trivial implementation task, the AI should be able to state:

- authoritative documents consulted;
- approved ADRs consulted;
- existing implementation inspected;
- tests inspected;
- unresolved ambiguities;
- validation performed after the change.

## Implementation-progress authority (roadmap)

- The living implementation roadmap `docs/00-overview/03-implementation-roadmap.md` is the authoritative source of project implementation state and the IMMEDIATE NEXT STEP for AI sessions.
- AI must consult the roadmap at session start and obey the IMMEDIATE NEXT STEP unless the user explicitly overrides it.
- Do not mark a roadmap step complete based solely on code presence. A step is complete only when the roadmap marks it COMPLETE and records validation evidence.

## Roadmap update requirement

After every meaningful implementation step the AI MUST update `docs/00-overview/03-implementation-roadmap.md` with status, implementation summary, files changed, tests run, validation results, evidence references, remaining risks, and the IMMEDIATE NEXT STEP.

The AI must not declare a step COMPLETE until the roadmap is updated with validation evidence and the roadmap shows the step as COMPLETE.

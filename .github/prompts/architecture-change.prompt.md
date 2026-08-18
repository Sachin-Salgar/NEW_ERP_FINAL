---
agent: 'agent'
description: Analyze a proposed NEW_ERP_FINAL architecture change without bypassing ADR governance
---

# Architecture Change Workflow

Use this workflow whenever a request changes an architectural decision or a governance-controlled cross-cutting concern.

## Rules

- Do not implement the architectural change in this workflow.
- Read `docs/00-overview/02-governance.md` and `docs/10-adr/README.md` first.
- Identify the affected SAD sections and existing ADRs.
- Determine whether an approved ADR already authorizes the requested change.
- If no approved ADR authorizes it, stop at the decision boundary.
- Do not rewrite authoritative documentation to make the requested implementation appear valid.

## Return

1. Proposed architectural change.
2. Current authoritative decision.
3. Applicable ADRs and their statuses.
4. Affected architecture areas/modules.
5. Impacted security, tenancy, database, API, deployment, or platform concerns.
6. Existing implementation affected.
7. Required ADR decision.
8. Recommended next governance action.

No production code changes are permitted in this workflow.

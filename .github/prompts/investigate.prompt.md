---
agent: true
description: Investigate an ERP task without changing files
---

# Investigate ERP Task

Investigate the user's request using the repository-aware workflow.

## Rules

- Do not modify files.
- Treat `docs/` as authoritative according to `.ai/authority.md`.
- Start from `docs/README.md` and `docs/00-overview/02-governance.md`.
- Identify the smallest relevant documentation and code boundary.
- Inspect applicable approved ADRs.
- Inspect existing implementation and relevant tests.
- Do not invent missing requirements.
- If authoritative sources conflict, report the conflict.

## Return

1. Request classification.
2. Authoritative documents consulted.
3. Applicable ADRs.
4. Relevant implementation files.
5. Relevant tests.
6. Existing behavior.
7. Required behavior inferred directly from authoritative sources.
8. Gaps/ambiguities that require user decisions.
9. Proposed implementation boundary.
10. Validation plan.

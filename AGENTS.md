# NEW_ERP_FINAL — Agent Contract

This repository is documentation-first. The ERP documentation under `docs/` is the authoritative source of truth. AI workflow files are process/navigation aids and must never become a competing architecture.

## Required behavior

For every non-trivial engineering request:

1. Understand the requested outcome and classify the task.
2. Discover the relevant repository area; do not ingest the entire repository indiscriminately.
3. Read `docs/README.md` and `docs/00-overview/02-governance.md` first.
4. Use `.ai/repository-map.md` and generated `.ai/generated/*` artifacts only as navigation aids; verify important conclusions against the actual authoritative documents.
5. Identify and read the authoritative architecture, development-standard, module, security, database, and approved-ADR documents relevant to the task.
6. Inspect existing code, configuration, migrations, interfaces, and tests that can be affected.
7. Build an evidence-based implementation plan.
8. If requirements or authoritative sources are missing, ambiguous, or contradictory, stop and ask. Never silently invent a rule.
9. If the request is clear and does not require an architectural decision, proceed to implementation without unnecessary confirmation.
10. Validate the change using the repository's applicable tests, static checks, typecheck, build, and integration/security/database checks.
11. Review the result against the authoritative documentation before declaring completion.
12. Report evidence, files changed, validation results, and unresolved risks.

## Authority

Use this order when sources overlap:

1. Approved ADRs for decisions within their scope.
2. Current Software Architecture Documentation.
3. Development Standards.
4. Module Specifications.
5. Existing source/tests as implementation evidence.
6. AI inference.

Historical/archive material is not current authority unless explicitly referenced by a current authoritative document.

If code conflicts with authoritative documentation, report the conflict. Do not rewrite documentation merely to make code appear compliant.

## No-invention rule

Do not invent business rules, database fields/relationships, tenancy behavior, authorization, API contracts, module boundaries, security requirements, event contracts, configuration semantics, or deployment behavior. Ask when the repository does not establish the required fact.

## Architecture-change gate

A request that changes an approved architectural decision, cross-cutting boundary, tenancy/security model, database architecture, or other governed decision must stop at the decision boundary and follow the ADR/governance process before implementation proceeds.

## Completion rule

"Implemented" means the code is changed and applicable validation has actually run. Never claim a test, build, typecheck, lint, scan, or review passed unless it was executed and passed.

## Primary workflow references

- `.github/copilot-instructions.md` — Copilot repository contract.
- `.ai/authority.md` — authority rules.
- `.ai/repository-map.md` — navigation map.
- `.ai/workflows/feature-development.md` — feature lifecycle.
- `.ai/workflows/repository-maintenance.md` — AI/repository maintenance.
- `.ai/workflows/ai-system.md` — AI workflow design rules.

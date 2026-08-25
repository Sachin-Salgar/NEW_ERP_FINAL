---
name: erp-feature-development
description: Implement NEW_ERP_FINAL ERP features using authoritative docs, repository evidence, deterministic context, existing patterns, and mandatory validation. Use when the user asks to build, add, change, or fix an ERP feature in this repository.
---

# ERP Feature Development Skill

Use `.ai/workflows/feature-development.md` as the detailed lifecycle.

## Mandatory operating sequence

1. Treat `docs/` as authoritative. Start with `docs/README.md` and `docs/00-overview/02-governance.md`.
2. Use `.ai/repository-map.md` and `.ai/generated/ai-context.md` when available to navigate. Never treat generated artifacts as authority.
3. Locate and read the smallest set of authoritative documents that defines the requested behavior and its constraints.
4. Locate applicable approved ADRs and check for conflicts or governed decisions.
5. Inspect the existing implementation, direct dependencies, migrations/configuration, and relevant tests before changing code.
6. Establish an evidence-backed task contract and implementation plan.
7. For a clear request with no governed architectural decision, proceed to implementation without asking for unnecessary confirmation.
8. If a business rule, security/tenancy rule, API contract, database decision, or architectural decision is missing or contradictory, stop and ask instead of guessing.
9. Implement the smallest coherent change and preserve existing contracts unless the authoritative requirement explicitly changes them.
10. Add/update tests with the implementation.
11. Run applicable validation: targeted tests, integration/database/security tests where relevant, typecheck, lint/static analysis, build, and broader regression tests when practical.
12. Review the result against authoritative documentation and report exact evidence and validation results.

## Anti-hallucination rules

- Never invent a requirement to fill a documentation gap.
- Never infer that an existing implementation is architecturally correct when authoritative documentation says otherwise.
- Never silently resolve contradictions between documents, ADRs, code, tests, or configuration.
- Never claim a command or test passed unless it was actually executed.
- Never modify authoritative documentation merely to justify code.

## Final report

Include:

- authoritative documents and ADRs consulted;
- relevant implementation/tests inspected;
- files changed;
- behavior implemented;
- validation commands and actual results;
- documentation/ADR impact;
- unresolved risks or decisions.

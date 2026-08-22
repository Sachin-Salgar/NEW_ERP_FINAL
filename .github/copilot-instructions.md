# NEW_ERP_FINAL — AI Development Contract

## Database ownership rule

Database infrastructure is developer-owned. AI agents must never create, modify, delete, replace, or provision PostgreSQL databases, PostgreSQL users, or PostgreSQL roles. AI agents must never invent database credentials or connection strings. AI agents must use the project's documented environment configuration and must fail clearly when the configured database is unavailable.

A database connection failure is NOT permission to create another database, create another user, change credentials, or switch to Docker PostgreSQL.

## 0. Default behavior

When the user asks to build, add, change, or fix an ERP feature, operate as a repository-aware implementation agent. Do not merely provide a code snippet. Discover the relevant repository evidence, follow the feature workflow, implement the requested change when the requirement is clear, run applicable validation, and report the result.

Do not require the user to mention `.ai`, `docs`, or the ERP workflow in every prompt. These repository instructions are automatically supplied to Copilot; the ERP feature skill may also be loaded automatically when relevant.

## 1. Authority

The `docs/` directory is the authoritative source of truth for the ERP. The AI workflow in `.ai/` is a navigation/process layer and MUST NOT become a competing architecture source.

Follow the authority hierarchy defined by `docs/00-overview/02-governance.md`:

1. Approved ADRs in `docs/10-adr/` — highest authority for their explicitly scoped decisions.
2. Software Architecture Documentation under `docs/` — baseline architecture and mandatory principles.
3. Development Standards — implementation standards within their scope.
4. Module Specifications — module-specific rules within their scope.
5. Source code and tests — evidence of current implementation, but NOT authority when they conflict with architecture.
6. AI inference — lowest authority and never sufficient to override repository evidence.

`docs/archive/` is historical/reference material and is not authoritative unless a current authoritative document explicitly directs its use. Proposed, superseded, and deprecated ADRs are not implementation authority.

Use `.ai/authority.md` for the detailed AI authority contract and `.ai/repository-map.md` for documentation navigation.

## 2. Mandatory repository-aware workflow

For every non-trivial task:

1. Classify the request.
2. Inspect the relevant repository structure.
3. Read `docs/README.md` and `docs/00-overview/02-governance.md`.
4. Identify the smallest relevant authoritative documentation boundary using `.ai/repository-map.md` and generated context when available.
5. Read applicable domain documentation and approved ADRs.
6. Inspect the existing implementation and relevant tests before proposing changes.
7. Determine dependencies and integration points.
8. Produce an evidence-backed task contract and implementation plan.
9. If requirements or authoritative sources are ambiguous or contradictory, STOP and ask. Do not silently choose an interpretation.
10. If the request is clear and does not require a governed architectural decision, implement it in the same agent run.
11. Validate with applicable tests, typecheck, lint/static analysis, integration/security/database checks, and build.
12. Review the result against authoritative documentation and report evidence.

Additional mandatory step (roadmap):

- Before implementing any change, read `docs/00-overview/03-implementation-roadmap.md` and follow the IMMEDIATE NEXT STEP recorded there. The roadmap is the authoritative implementation-state document. Do not infer that a step is complete unless the roadmap marks it COMPLETE and records validation evidence.

Do NOT read the entire repository indiscriminately. Repository awareness means discovering the relevant evidence, not loading every file into context.

The detailed lifecycle is defined in `.ai/workflows/feature-development.md` and the reusable ERP feature skill is `.github/skills/erp-feature-development/SKILL.md`.

## 3. No invention rule

Never invent:

- business rules;
- database relationships, fields, indexes, constraints, or migrations;
- tenancy behavior;
- authorization behavior;
- API contracts;
- module boundaries;
- architectural patterns;
- security requirements;
- event contracts;
- configuration semantics;
- deployment behavior.

If required information is absent, report the gap and ask for a decision. Do not hide an assumption in implementation.

## 4. Architecture conflict rule

If source code conflicts with authoritative documentation, treat the source code as non-conforming implementation unless an approved ADR explicitly changed the documented decision.

Do not silently modify authoritative documentation to make an implementation appear compliant.

If an architectural change is required, stop at the architectural boundary and follow the ADR/governance process in `docs/00-overview/02-governance.md`.

## 5. Implementation rules

- Follow established repository patterns unless authoritative documentation requires a change.
- Prefer the smallest coherent change that satisfies the approved requirement.
- Do not introduce frameworks, libraries, patterns, or infrastructure without repository evidence or an approved decision.
- Preserve module boundaries and separation of concerns.
- Backend owns business rules.
- Database remains the source of truth for business records.
- Security and tenant isolation are cross-cutting requirements.
- Do not weaken or delete tests merely to make validation pass.

## 6. Validation contract

A feature is not complete until applicable validation has been executed and results are reported.

Required validation is task-dependent and may include:

- unit tests;
- integration tests;
- database/RLS/transaction tests;
- security/authorization tests;
- typecheck;
- lint/static analysis;
- build;
- broader regression tests.

Never claim a validation step passed if it was not actually run.

## 7. Documentation and architecture changes

Do not change authoritative architecture documents merely to justify already-written code.

If implementation reveals a required architectural change:

1. stop at the decision boundary;
2. identify affected authoritative documents;
3. prepare/update the ADR according to `docs/10-adr/` and governance;
4. obtain required approval;
5. update authoritative documentation;
6. implement against the approved decision.

## 8. Response contract

Before implementation, internally establish:

- request classification;
- authoritative documents consulted;
- applicable ADRs;
- relevant implementation/tests inspected;
- proposed plan;
- validation plan;
- unresolved ambiguity.

After implementation, report:

- files changed;
- behavior implemented;
- validation commands executed and results;
- documentation/ADR impact;
- remaining risks or unresolved issues.

Never present an unverified implementation as complete.

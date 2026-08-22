# Feature Development Workflow

This is the default workflow for implementing a non-trivial ERP feature. It is designed so a clear user request can proceed from discovery to implementation without requiring the user to manually orchestrate AI context files.

Session initialization (MANDATORY before any change)

- At the start of every AI implementation session perform the Session Initialization sequence defined in `.ai/workflows/ai-system.md`.
- In short: run `git status --short --untracked-files=all`, note branch and recent commits, read the living roadmap `docs/00-overview/03-implementation-roadmap.md` and extract the CURRENT IMPLEMENTATION CHECKPOINT (CURRENT SLICE, CURRENT STEP, IMMEDIATE NEXT STEP), and read only the authoritative documents required for the IMMEDIATE NEXT STEP per `.ai/authority.md`.
- The agent must explicitly state which roadmap step it will implement before any code modification. If it cannot, STOP and ask.

Roadmap-first rule

- The roadmap is the authoritative implementation-progress source. The agent must normally implement exactly the IMMEDIATE NEXT STEP recorded in the roadmap. Do not skip or re-order roadmap steps without updating the roadmap.

## Operating modes

- **Clear feature request:** investigate, plan, implement, validate, update the roadmap with evidence, and report in one controlled run. Do not ask for unnecessary confirmation unless a governance decision is required.
- **Ambiguous requirement:** investigate what can be established, identify the exact ambiguity, record the ambiguity in the roadmap if it blocks progress, then STOP and ask.
- **Authority conflict:** STOP and report the conflicting sources. Do not choose silently.
- **Architectural/governed change:** STOP at the decision boundary and follow the ADR/governance process before implementation. Record the block in the roadmap.
- **Investigation-only request:** do not modify production files.
- **Review/fix request:** inspect the requested change and validation evidence first; make only the changes required by the review findings and update the roadmap accordingly.

## Phase 0 — Classify

Determine whether the request is clarification/documentation, bug fix, feature, database change, security change, architecture change, refactoring, or test/infrastructure work. Determine the minimum inspection boundary needed.

## Phase 1 — Discover

1. Read `docs/README.md`.
2. Read `docs/00-overview/02-governance.md`.
3. Identify the business/domain area involved.
4. Use `.ai/repository-map.md` and generated context, when present, to locate the relevant documentation and code. Treat generated context as navigation only.
5. Locate applicable approved ADRs in `docs/10-adr/`.
6. Read the relevant authoritative architecture, standards, module, database, security, and business documentation.
7. Inspect the current implementation for the affected module and direct dependencies.
8. Inspect relevant tests, fixtures, migrations, configuration, API contracts, and integration points.

Do not ingest the entire repository merely because the task is broad. Expand the inspection boundary only when dependency evidence requires it.

## Phase 2 — Establish the task contract

Create an internal evidence-backed contract containing:

- requested behavior;
- authoritative documents;
- applicable ADRs;
- affected modules;
- existing implementation pattern;
- data/API/security/tenancy implications;
- required tests and validation;
- unresolved questions.

Do not invent missing requirements. If a missing decision is required to implement safely, STOP and ask.

## Phase 3 — Plan

Create an implementation plan identifying:

- files/components to add or change;
- database changes and migration implications;
- API changes;
- domain/business logic;
- authorization/tenant implications;
- tests;
- documentation/ADR updates, if required.

For a clear, non-governed request, the plan is an internal gate and implementation may proceed in the same run. Present the plan to the user before implementation only when the user asks for planning first or when human approval is required by governance.

## Phase 4 — Implement

Implement the smallest coherent change that satisfies the established requirement.

Rules:

- follow existing patterns;
- do not introduce unapproved technology;
- do not duplicate business logic across layers;
- do not weaken security or tenancy boundaries;
- do not delete tests to make validation pass;
- do not hide assumptions in code;
- preserve backward compatibility unless the authoritative requirement explicitly changes it.

## Phase 5 — Validate

Run the strongest applicable validation available in the repository:

1. targeted unit tests;
2. targeted integration tests;
3. database/RLS/transaction tests where applicable;
4. security/authorization tests where applicable;
5. typecheck;
6. lint/static analysis;
7. build;
8. broader regression tests when practical.

Never claim a validation step passed unless it actually ran and passed.

## Phase 6 — Review

Compare the implementation against:

- authoritative documentation;
- applicable ADRs;
- user requirements;
- module boundaries;
- security and tenancy rules;
- tests.

Look specifically for invented behavior, undocumented assumptions, accidental API changes, missing validation, architecture drift, and incomplete error handling.

If a conflict is discovered after implementation, do not paper over it. Stop, report it, and follow the authority/ADR process.

## Phase 7 — Report

Report:

### Discovery
- authoritative documents consulted;
- ADRs consulted;
- implementation/tests inspected.

### Implementation
- files changed;
- behavior implemented;
- architectural impact.

### Validation
- commands run;
- pass/fail results;
- tests added/changed.

### Exceptions
- unresolved ambiguity;
- known limitations;
- follow-up work.

A feature is complete only when the applicable implementation and validation gates have passed.

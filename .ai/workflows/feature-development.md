# Feature Development Workflow

This is the default workflow for implementing a non-trivial ERP feature.

## Phase 0 — Classify the request

Determine whether the request is:

- clarification/documentation only;
- bug fix;
- feature implementation;
- database change;
- security change;
- architectural change;
- refactoring;
- test/infrastructure change.

If it is an architectural change, follow the ADR/governance process before implementation.

## Phase 1 — Discover

1. Read `docs/README.md`.
2. Read `docs/00-overview/02-governance.md`.
3. Identify the business/domain area involved.
4. Locate the relevant documentation domain(s) using `.ai/repository-map.md`.
5. Locate applicable approved ADRs in `docs/10-adr/`.
6. Inspect the current implementation for the affected module and its direct dependencies.
7. Inspect relevant tests and test fixtures.

Do not scan or ingest the whole repository merely because the task is broad. Expand the inspection boundary only when dependency evidence requires it.

## Phase 2 — Establish the contract

Before coding, produce a concise internal task contract:

- requested behavior;
- authoritative documents;
- applicable ADRs;
- affected module(s);
- existing implementation pattern;
- data/API/security implications;
- required tests;
- unresolved questions.

If a required business or architectural decision is missing, STOP and ask.

## Phase 3 — Plan

Create an implementation plan that identifies:

- files/components to add or change;
- database changes and migration implications;
- API changes;
- domain/business logic;
- authorization/tenant implications;
- tests;
- documentation updates, if required.

Do not write production code until the plan is internally consistent with authoritative documentation. For tasks where human approval is appropriate, present the plan before implementation.

## Phase 4 — Implement

Implement the smallest coherent change that satisfies the approved requirement.

Rules:

- follow existing patterns;
- do not introduce unapproved technology;
- do not duplicate business logic across layers;
- do not weaken security or tenancy boundaries;
- do not delete tests to make validation pass;
- do not hide assumptions in code.

## Phase 5 — Validate

Run the strongest applicable validation available in the repository:

1. targeted unit tests;
2. targeted integration tests;
3. typecheck;
4. lint/static analysis;
5. build;
6. broader test suite when practical.

Database, tenancy, security, transaction, or authorization changes require the corresponding integration/security validation.

## Phase 6 — Review

Compare the implementation against:

- authoritative documentation;
- applicable ADRs;
- stated requirements;
- existing module boundaries;
- security and tenancy rules;
- tests.

Look specifically for invented behavior, undocumented assumptions, accidental API changes, missing validation, and architecture drift.

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

Never report a feature as complete when required validation has not passed.

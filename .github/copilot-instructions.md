# NEW_ERP_FINAL — AI Development Contract

## 1. Authority

The `docs/` directory is the authoritative source of truth for the ERP.

Follow this authority hierarchy:

1. Approved ADRs in `docs/10-adr/` — highest authority for their explicitly scoped decisions.
2. Current Software Architecture Documentation under `docs/` — baseline architecture and mandatory principles.
3. Development standards and module specifications under `docs/` — implementation rules within their scope.
4. Source code and tests — evidence of the current implementation, but NOT authority when they conflict with architecture.
5. AI inference — lowest authority; never use inference to override repository evidence.

`docs/archive/` is historical/reference material and is not authoritative unless a current document explicitly references it.
Proposed, deprecated, or superseded ADRs are not authoritative decisions.

## 2. Mandatory repository-aware workflow

Before modifying code for any non-trivial task:

1. Inspect the repository structure relevant to the task.
2. Read `docs/README.md` and the relevant authoritative documentation before making architectural or business assumptions.
3. Identify applicable principles, architecture rules, security rules, database rules, module specifications, and approved ADRs.
4. Inspect the existing implementation and relevant tests for the affected area.
5. Determine dependencies and integration points before changing interfaces or shared behavior.
6. State the implementation plan and the authoritative documents/code/tests used to form it.
7. If the requirements, documentation, ADRs, or existing implementation are ambiguous or contradictory, STOP and ask for clarification. Do not silently choose an interpretation.

Do NOT read the entire repository indiscriminately. Discover the relevant area from the documentation and repository structure, then inspect the files required for the task.

## 3. No invention rule

Never invent:

- business rules
- database relationships or fields
- tenancy behavior
- authorization behavior
- API contracts
- module boundaries
- architectural patterns
- security requirements
- event contracts
- configuration semantics

when the repository does not establish them.

If required information is missing, explicitly report the gap and ask for a decision. Do not hide an assumption in implementation.

## 4. Architecture conflict rule

If source code conflicts with authoritative documentation, treat the source code as a defect unless an approved ADR explicitly changed the documented decision.

Do not silently modify architecture documentation to make an implementation appear compliant.

If an architectural change is required, identify it as an architectural change and require the ADR/governance process defined by `docs/00-overview/02-governance.md` before implementation.

## 5. Implementation rules

- Follow existing repository patterns unless authoritative documentation requires a change.
- Prefer the smallest change that satisfies the approved requirement.
- Do not introduce new frameworks, libraries, patterns, or infrastructure without evidence that they are allowed by the authoritative documentation or an approved ADR.
- Preserve module boundaries and separation of concerns.
- Backend owns business logic.
- Database remains the source of truth for business records.
- Security and tenant isolation must be treated as cross-cutting requirements.
- Do not weaken existing tests or remove validation merely to make a build pass.

## 6. Validation is mandatory

After implementation, run the repository's applicable validation commands:

- unit tests
- integration tests
- typecheck
- build
- lint/static analysis when configured

For database, tenancy, security, or transaction changes, run the relevant integration/security tests as well.

Do not claim a feature is complete when required validation is failing or has not been run. Report exactly what was executed and the result.

## 7. Documentation changes

Do not modify authoritative architecture documentation merely to justify code that was already written.

If implementation reveals that an architectural decision must change:

1. Stop implementation at the architectural boundary.
2. Identify the affected authoritative documents.
3. Create/update an ADR according to `docs/10-adr/` and `docs/00-overview/02-governance.md`.
4. Obtain the required approval before treating the new decision as authoritative.
5. Then update implementation and affected documentation consistently.

## 8. Response contract

For a feature request, first report:

- what you found
- authoritative sources consulted
- affected modules/files
- dependencies
- proposed implementation
- validation plan
- any unresolved ambiguity

After implementation, report:

- files changed
- behavior implemented
- tests/validation executed
- results
- remaining risks or unresolved issues

Never present an unverified implementation as complete.

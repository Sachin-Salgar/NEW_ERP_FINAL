---
agent: 'agent'
description: Implement a clear NEW_ERP_FINAL ERP feature using repository authority, existing patterns, and mandatory validation
---

# Implement ERP Feature

Use `.ai/workflows/feature-development.md` and the `erp-feature-development` skill when relevant.

The user will provide the feature request after invoking this prompt. Do not require the user to repeat repository rules.

## Before editing

1. Classify the request.
2. Read `docs/README.md` and `docs/00-overview/02-governance.md`.
3. Identify and read the authoritative documentation and approved ADRs relevant to the feature.
4. Inspect existing implementation, direct dependencies, migrations/configuration, and tests.
5. Establish the evidence-backed task contract.

If there is an unresolved business, architectural, security, tenancy, database, or API decision, STOP and ask the user. Do not guess.

For a clear request that does not require a governed architectural decision, proceed through implementation without unnecessary confirmation.

## Implementation

- Follow the authoritative architecture and existing repository patterns.
- Make the smallest coherent change.
- Add or update tests with the implementation.
- Preserve existing behavior unless the approved requirement explicitly changes it.
- Do not modify authoritative architecture documents to justify an implementation.
- Do not claim completion until validation has actually run.

## Validation

Run applicable tests, typecheck, lint/static analysis, build, and integration/security/database validation where relevant. If a required command cannot run in the environment, report it as not run rather than passing it by assumption.

## Final response

Provide:

- authoritative sources and ADRs used;
- files changed;
- implementation summary;
- tests/validation run and exact results;
- documentation/ADR impact;
- unresolved issues or risks.

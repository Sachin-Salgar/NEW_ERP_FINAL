---
agent: true
description: Implement an approved ERP feature using repository authority and validation
---

# Implement ERP Feature

Use `.ai/workflows/feature-development.md`.

## Before editing

1. Re-run the relevant discovery steps for the requested feature.
2. Confirm the authoritative documentation and approved ADRs.
3. Inspect existing implementation and tests.
4. Identify unresolved requirements.

If there is an unresolved architectural, business, security, tenancy, database, or API decision, STOP and ask the user. Do not guess.

## Implementation

- Follow the established architecture and existing patterns.
- Make the smallest coherent change.
- Add or update tests with the implementation.
- Preserve existing behavior unless the approved requirement explicitly changes it.
- Do not modify authoritative architecture documents to justify an implementation.

## Validation

Run applicable tests, typecheck, lint/static analysis, and build. Add integration/security/database validation where relevant.

## Final response

Provide:

- authoritative sources used;
- files changed;
- implementation summary;
- tests/validation run and exact results;
- unresolved issues or risks.

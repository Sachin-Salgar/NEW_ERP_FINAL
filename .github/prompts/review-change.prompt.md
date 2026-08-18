---
agent: true
description: Review an ERP change against authoritative documentation and repository rules
---

# Review ERP Change

Review the current change without making modifications unless the user explicitly asks for fixes.

## Review against

1. `docs/00-overview/02-governance.md`
2. applicable authoritative documentation under `docs/`
3. applicable approved ADRs
4. existing module boundaries and implementation patterns
5. relevant tests
6. security and tenant-isolation requirements

## Look for

- architecture drift;
- invented business behavior;
- undocumented assumptions;
- authority conflicts;
- API contract violations;
- database integrity problems;
- tenancy/security bypasses;
- missing transaction boundaries;
- missing tests;
- failed or absent validation;
- unnecessary dependencies or abstractions.

## Output

Classify findings as:

- **BLOCKER** — must be resolved before merge.
- **HIGH** — serious correctness/security/architecture risk.
- **MEDIUM** — important quality issue.
- **LOW** — improvement opportunity.

For each finding, cite the relevant repository file/document and explain the evidence.

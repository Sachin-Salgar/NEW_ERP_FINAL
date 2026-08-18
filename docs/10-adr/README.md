# Architecture Decision Records (ADRs)

This directory contains the Architecture Decision Records for the ERP platform.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision, its context, alternatives, rationale, consequences, and scope.

Each ADR documents:
- **Context**: What problem are we solving?
- **Decision**: What was decided?
- **Rationale**: Why was it decided?
- **Alternatives Considered**: What other options were evaluated?
- **Consequences**: Positive and negative impacts
- **Scope**: Which architecture area the decision governs
- **References**: Other affected documents

## ADR Status

- **Proposed**: Under consideration; not binding and must not be implemented as an architectural commitment.
- **Approved**: Approved by the Architecture Review Board; binding within the ADR's explicit scope.
- **Superseded**: Replaced by a later approved ADR; not binding.
- **Deprecated**: No longer recommended; not binding for new decisions.

Only **Approved** ADRs are authoritative decisions.

## Authority Rules

Approved ADRs override conflicting architecture documentation **only within the scope explicitly covered by the ADR**.

A proposed ADR is evidence of a possible future decision, not permission for AI or developers to implement it.

If an ADR conflicts with another authoritative document and the scope cannot be resolved unambiguously, implementation must stop and the conflict must be escalated for human decision.

## ADR Format

```text
# ADR-NNNN: [Decision Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Approved | Superseded | Deprecated
**Approval Date**: YYYY-MM-DD (if approved)
**Approved By**: [Architecture Review Board]
**Scope**: [Explicit scope]

## Context

[Problem and context]

## Decision

[Decision]

## Rationale

[Why this decision]

## Alternatives Considered

[Alternatives and reasons]

## Consequences

[Positive and negative consequences]

## Implementation Notes

[Implementation guidance]

## Related Documents

[Repository references]
```

## ADR Lifecycle

```text
Proposed
    ↓
Architecture Review Board
    ├── Rejected → close without implementation
    └── Approved
          ↓
      Implementation
          ↓
      May later be superseded
```

## Current ADRs

| ID | Title | Status | Date |
|----|-------|--------|------|
| [0005](./0005-uuid-version-standard.md) | UUID Version Standard | Approved | 2026-08-07 |
| [0006](./0006-postgresql-rls-tenancy.md) | PostgreSQL RLS for Tenancy | Approved | 2026-08-07 |
| [0007](./0007-zero-downtime-migrations.md) | Zero-Downtime Migration Strategy | Approved | 2026-08-07 |
| [0008](./0008-event-contracts-versioning.md) | Event Contracts & Versioning | Proposed | 2026-08-07 |
| [0009](./0009-token-refresh-rotation.md) | Token Strategy — Refresh Token Rotation | Proposed | 2026-08-07 |

This table is the authoritative status index for the ADRs listed above. A file's own `Status` field must agree with this table. Any disagreement is a documentation defect that must be resolved before implementation relies on that ADR.

## How to Create an ADR

1. Identify the architectural decision.
2. Define the context and problem.
3. Propose a decision.
4. Consider alternatives.
5. Assess consequences.
6. Define explicit scope.
7. Submit for Architecture Review Board review.
8. If approved, update the ADR status and affected authoritative documentation.
9. Implement only after approval.

## ADR Numbering

ADRs use sequential identifiers: `ADR-0001`, `ADR-0002`, etc.

The next available identifier after the current index is **ADR-0010**.

## Superseding an ADR

When an ADR is superseded:

1. Mark the original ADR `Superseded`.
2. Reference the superseding ADR.
3. Create the new ADR with a new identifier.
4. Update affected documentation.
5. Ensure AI/navigation indexes reflect the new status.

## Related Documentation

- [Document Control & Governance](../00-overview/02-governance.md)
- [Architectural Principles](../00-overview/01-architectural-principles.md)
- [Core System Architecture](../02-architecture/README.md)

## Summary

ADRs provide traceability for major architectural decisions. They evolve as the ERP evolves, but only approved decisions are binding. Proposed decisions must never be treated as implementation authority.

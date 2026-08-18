# Architecture Decision Records (ADRs)

This directory contains the Architecture Decision Records (ADRs) for the ERP platform.

## What is an ADR?

An ADR records an important architectural decision, its context, alternatives, rationale, consequences, scope, and affected documentation.

Each ADR should document:

- **Context** — the problem and circumstances.
- **Decision** — what was decided.
- **Rationale** — why it was decided.
- **Alternatives Considered** — other options and why they were not selected.
- **Consequences** — positive and negative effects.
- **Scope** — the architecture area governed by the decision.
- **Implementation Notes** — constraints and guidance, without silently turning unresolved TODOs into decisions.
- **References** — affected canonical documentation and related ADRs.

## ADR Status

- **Proposed** — under consideration; not binding and must not be treated as implementation authority.
- **Approved** — approved by the Architecture Review Board; binding only within the ADR's explicit scope.
- **Superseded** — replaced by a later approved ADR; not binding.
- **Deprecated** — no longer recommended; not binding for new decisions.

Only **Approved** ADRs are authoritative architectural decisions.

## Authority Rules

Approved ADRs override conflicting architecture documentation **only within the scope explicitly covered by the ADR**.

A Proposed ADR is evidence of a possible future decision, not permission for AI or developers to implement it as an architectural commitment.

If an ADR conflicts with another authoritative document and the scope cannot be resolved unambiguously, implementation must **STOP and ask** for human resolution.

ADRs do not override higher-level governance, security, legal, or regulatory requirements unless their scope explicitly and validly covers the matter.

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

[Implementation guidance and unresolved TODOs]

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
      May later be superseded or deprecated
```

Implementation must not begin solely because an ADR exists; its status and scope must authorize the decision.

## Current ADRs

| ID | Title | Status | Date | Scope |
|----|-------|--------|------|-------|
| [0005](./0005-uuid-version-standard.md) | UUID Version Standard | Approved | 2026-08-07 | UUID primary identifier generation |
| [0006](./0006-postgresql-rls-tenancy.md) | PostgreSQL RLS for Tenancy | Approved | 2026-08-07 | Tenant isolation for tenant-owned PostgreSQL data |
| [0007](./0007-zero-downtime-migrations.md) | Zero-Downtime Migration Strategy | Approved | 2026-08-07 | Production database migrations |
| [0008](./0008-event-contracts-versioning.md) | Event Contracts & Versioning | Proposed | 2026-08-07 | Cross-module/integration event contract versioning |
| [0009](./0009-token-refresh-rotation.md) | Token Strategy — Refresh Token Rotation | Proposed | 2026-08-07 | Refresh-token lifecycle |

This table is the authoritative status index for the ADRs listed above. Each ADR's `Status` field must agree with this table. A disagreement is a documentation defect that must be resolved before implementation relies on that ADR.

## How to Create an ADR

1. Identify the architectural decision.
2. Define the context and problem.
3. Propose the decision.
4. Consider alternatives.
5. Define the explicit scope.
6. Assess consequences.
7. Submit the ADR for Architecture Review Board review.
8. If approved, update the ADR status and affected authoritative documentation.
9. Implement only when an applicable approved decision authorizes the implementation.

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

ADRs provide traceability for major architectural decisions. They evolve as the ERP evolves, but only approved decisions are binding within their defined scope. Proposed decisions must never be treated as implementation authority.

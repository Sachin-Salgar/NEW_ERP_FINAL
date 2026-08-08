# Architecture Decision Records (ADRs)

This directory contains all approved Architecture Decision Records for the ERP platform.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made on a project or in an organization.

Each ADR documents:
- **Context**: What problem are we solving?
- **Decision**: What did we decide?
- **Rationale**: Why did we make this choice?
- **Alternatives Considered**: What other options did we evaluate?
- **Consequences**: What are the positive and negative impacts?
- **References**: What other documents does this affect?

## ADR Format

Each ADR follows this structure:

```
# ADR-NNNN: [Decision Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Approved | Superseded | Deprecated
**Approval Date**: YYYY-MM-DD (if approved)
**Approved By**: [Architecture Review Board members]

## Context

[Describe the issue that motivated this decision]

## Decision

[Describe the decision that was made]

## Rationale

[Explain why this decision was made over alternatives]

## Alternatives Considered

1. **Alternative 1**: [Description]
   - Pros: [...]
   - Cons: [...]

2. **Alternative 2**: [Description]
   - Pros: [...]
   - Cons: [...]

## Consequences

### Positive
- [...]

### Negative
- [...]

## Implementation Notes

[Any implementation guidance or gotchas]

## Related Documents

- [Document 1]
- [Document 2]

## References

- [External reference 1]
- [External reference 2]
```

## ADR Lifecycle

### Status Values

- **Proposed**: Decision under consideration, awaiting Architecture Review Board evaluation
- **Approved**: Decision approved by Architecture Review Board; ready for implementation
- **Superseded**: An approved ADR has superseded this decision (see reference)
- **Deprecated**: No longer recommended but not superseded (use with caution)

### Progression

```
Proposed
    ↓
Architecture Review Board Meeting
    ↓
Approved  OR  Rejected
    ↓
Implementation
    ↓
(May be Superseded by later ADR)
```

## Current ADRs

### Volume 1 Foundation ADRs

Currently, Volume 1 establishes architectural principles through the main SAD (Software Architecture Document) rather than individual ADRs. The following ADR areas are anticipated:

**Pending ADRs** (to be created as decisions are formalized):
- Multi-Tenant Isolation Strategy
- API Versioning Strategy
- Authentication Architecture (JWT details)
- Event-Driven Architecture (if adopted)
- Microservice Extraction Criteria
- Database Partitioning Strategy
- Offline Synchronization (if implemented)
- Search Architecture (Elasticsearch vs. alternatives)
- Rule Engine Architecture (if adopted)
- Localization Architecture (if adopted)

## How to Create an ADR

1. **Identify the decision**: What architectural decision needs to be made?
2. **Document the context**: Why is this decision needed?
3. **Propose a decision**: What is the recommended choice?
4. **Consider alternatives**: What other options exist?
5. **Assess consequences**: What are the impacts?
6. **Request review**: Submit to Architecture Review Board
7. **Get approval**: Board reviews and approves
8. **Implement**: Update documentation and implementation accordingly

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [0005](./0005-uuid-version-standard.md) | UUID Version Standard | Approved | 2026-08-07 |
| [0006](./0006-postgresql-rls-tenancy.md) | PostgreSQL RLS for Tenancy | Approved | 2026-08-07 |
| [0007](./0007-zero-downtime-migrations.md) | Zero-Downtime Migration Strategy | Approved | 2026-08-07 |
| [0008](./0008-event-contracts-versioning.md) | Event Contracts & Versioning | Proposed | 2026-08-07 |
| [0009](./0009-token-refresh-rotation.md) | Token Strategy — Refresh Token Rotation | Proposed | 2026-08-07 |

*ADRs will be added as architectural decisions are formalized*

## Architecture Decision Rules

When creating an ADR:

### Required Sections
- Title (clear, concise)
- Date (creation/approval date)
- Status (Proposed, Approved, etc.)
- Context (why is this needed?)
- Decision (what did we decide?)
- Rationale (why this choice?)

### Recommended Sections
- Alternatives Considered
- Consequences (positive and negative)
- Implementation Notes
- Related Documents
- References

### Publishing an ADR

1. Create new file: `docs/10-adr/ADR-NNNN-title.md`
2. Follow the ADR format
3. Submit as pull request
4. Architecture Review Board reviews
5. If approved, merge with status "Approved"

## ADR Numbering

ADRs are numbered sequentially:
- ADR-0001: First decision
- ADR-0002: Second decision
- etc.

Next available number: ADR-0010 (next unused number)

## Superseding an ADR

When an ADR is superseded:

1. Mark original ADR status as "Superseded"
2. Add reference to superseding ADR
3. Create new ADR with new decision
4. Update all references in documentation

Example:
```
**Status**: Superseded by ADR-0005
```

## Related Documentation

- [Document Control & Governance](../00-overview/02-governance.md) — ADR governance and approval process
- [Architectural Principles](../00-overview/01-architectural-principles.md#principle-10-documentation-is-part-of-the-product) — Documentation requirement
- [Decision-Making Hierarchy](../00-overview/02-governance.md#decision-making-hierarchy) — How ADRs fit in architecture

## Summary

Architecture Decision Records provide traceability and rationale for architectural decisions. Every significant architectural decision should have an ADR documenting the choice, alternatives considered, and consequences.

ADRs evolve as the project evolves. Decisions can be superseded when new context emerges or technology changes.

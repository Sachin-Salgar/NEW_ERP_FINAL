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
- **Implementation Notes** — implementation guidance without silently turning unresolved TODOs into decisions.
- **References** — affected canonical documentation and related ADRs.

## ADR Status

- **Proposed** — under consideration; not binding.
- **Approved** — approved and binding within the ADR's explicit scope.
- **Superseded** — replaced by a later approved ADR.
- **Deprecated** — no longer recommended for new decisions.

Only **Approved** ADRs are authoritative architectural decisions.

## Authority Rules

Approved ADRs override conflicting architecture documentation only within the scope explicitly covered by the ADR.

If an ADR conflicts with another authoritative document and the scope cannot be resolved unambiguously, implementation must stop until the conflict is resolved.

## ADR Format

```text
# ADR-NNNN: [Decision Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Approved | Superseded | Deprecated
**Approval Date**: YYYY-MM-DD (if approved)
**Approved By**: [Approver]
**Scope**: [Explicit scope]

## Context
## Decision
## Rationale
## Alternatives Considered
## Consequences
## Implementation Notes
## Related Documents
```

## Current ADRs

| ID | Title | Status | Date | Scope |
|----|-------|--------|------|-------|
| [0005](./0005-uuid-version-standard.md) | UUID Version Standard | Approved | 2026-08-07 | UUID primary identifier generation |
| [0006](./0006-identity-based-tenant-context.md) | Identity-Based Tenant Context and PostgreSQL RLS | Approved | 2026-08-27 | Authentication, tenant context, tenant isolation, web/mobile clients, SaaS and on-premises deployments |
| [0007](./0007-zero-downtime-migrations.md) | Zero-Downtime Migration Strategy | Approved | 2026-08-07 | Production database migrations |
| [0008](./0008-event-contracts-versioning.md) | Event Contracts & Versioning | Proposed | 2026-08-07 | Cross-module/integration event contract versioning |
| [0009](./0009-token-refresh-rotation.md) | Token Strategy — Refresh Token Rotation | Proposed | 2026-08-07 | Refresh-token lifecycle |
| [0010](./0010-organization-module-access.md) | Organization Module Access Boundary | Approved | 2026-08-26 | Tenant entitlement, organization module enablement, and effective permission access |
| [0011](./0011-organization-branch-location-context.md) | Organization, Branch, and Location Context Model | Approved | 2026-09-01 | Core enterprise context, business hierarchy, operational authorization, transaction scoping |
| [0012](./0012-branch-access-representation.md) | Branch Access Representation | Approved | 2026-09-03 | Tenant-scoped user authorization for Branch records |
| [0013](./0013-centralized-tls-managed-postgresql.md) | Centralized TLS for Managed PostgreSQL Connections | Approved | 2026-09-03 | PostgreSQL connection configuration for application runtime and operational tooling |

This table is the authoritative status index for the ADRs listed above. Each ADR's `Status` field must agree with this table.

## ADR Lifecycle

```text
Proposed
    ↓
Architecture Review
    ├── Rejected → close without implementation
    └── Approved
          ↓
      Implementation
          ↓
      May later be superseded or deprecated
```

Implementation must not rely on a Proposed ADR.

## ADR Numbering

ADRs use sequential identifiers: `ADR-0001`, `ADR-0002`, etc.

The next available identifier after the current index is **ADR-0014**.

## Related Documentation

- [Document Control & Governance](../00-overview/02-governance.md)
- [Architectural Principles](../00-overview/01-architectural-principles.md)
- [Core System Architecture](../02-architecture/README.md)

## Summary

ADRs provide traceability for major architectural decisions. Only approved decisions are binding within their defined scope.

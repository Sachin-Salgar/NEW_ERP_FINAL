# Overview: Principles & Governance

This directory contains foundational architectural principles and governance rules that apply across all ERP modules and platform services.

## Documents Contained

1. **[Architectural Principles](./01-architectural-principles.md)**: The ten mandatory architectural principles that govern all design and implementation decisions

2. **[Document Control & Governance](./02-governance.md)**: Document ownership, approval authority, decision-making hierarchy, and governance processes

## Purpose

The documents in this section establish:

- **Non-negotiable engineering standards** for the ERP platform
- **Decision-making authority** and precedence rules
- **Common foundation** for architectural consistency
- **Quality attributes** expected from all implementations

## Key Principles Summary

The ERP architecture is built on these core principles:

| # | Principle | Owner | Scope |
|---|-----------|-------|-------|
| 1 | Backend Owns Business Logic | Backend Services | All business rules |
| 2 | Frontend Is Presentation Only | Frontend Applications | UI and user interaction |
| 3 | Database Is Single Source of Truth | Data Services | Business records |
| 4 | Modules Must Remain Independent | Module Architects | Cross-module integration |
| 5 | Platform Before Features | Platform Team | Infrastructure first |
| 6 | Configuration Before Customization | Operations | Organizations adapt via config |
| 7 | Security by Design | Security Architect | All layers |
| 8 | Audit Everything Important | Data Governance | Business operations |
| 9 | Consistency Over Convenience | Architecture Board | Standards adherence |
| 10 | Documentation Is Part of the Product | All Teams | Architecture, ADRs |

## Related Documentation

- **[Vision & Business Objectives](../01-vision/README.md)** — Why the ERP exists and what it must accomplish
- **[Core System Architecture](../02-architecture/README.md)** — How the system is organized
- **[Architecture Decision Records](../10-adr/README.md)** — How specific architectural decisions were made

## Governance Process

### Decision-Making Hierarchy

When uncertainty exists, architectural decisions follow this order of precedence:

1. **Current authoritative architecture documentation under `docs/`** — Baseline architectural guidance
2. **Architecture Decision Records (ADRs)** — Approved decisions that supersede affected architecture sections within their explicit scope
3. **Development Standards** — Detailed implementation standards
4. **Module Specifications** — Module-specific design documents
5. **Source Code** — NOT the primary architectural reference

If authoritative documentation conflicts internally, AI and engineering teams must stop and surface the conflict for human resolution rather than silently choosing an interpretation.

### Architectural Governance

Major architectural changes require formal review:

- Database redesign
- Technology replacement
- Module framework changes
- Authentication redesign
- Deployment model changes

All major changes require an approved Architecture Decision Record.

## Document Status

| Item | Status | Owner |
|------|--------|-------|
| Principles | Current | Architecture Board |
| Governance | Current | Architecture Board |
| ADR Process | Active | Architecture Board |

## Next Steps

**New to the ERP architecture?** Start with:
1. [Architectural Principles](./01-architectural-principles.md) — Understand the foundational rules
2. [Vision & Objectives](../01-vision/README.md) — Understand what we're building
3. [System Architecture](../02-architecture/README.md) — Understand how it's organized

**Making an architectural decision?** See:
- [Governance](./02-governance.md) — Follow the decision-making process
- [Architecture Decision Records](../10-adr/README.md) — Document your decision

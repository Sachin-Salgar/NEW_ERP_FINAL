# Volume 3 → docs/ Mapping

This file provides the authoritative Phase 1 mapping from Enterprise ERP Architecture Volume 3 (Backend Architecture) chapters to canonical documents in the repository.

Format: Volume 3 Chapter → Destination File → Status

1) Chapter 1 — Backend Architecture Overview
↓
docs/04-backend/01-backend-overview.md
↓
Covered (created)

2) Chapter 2 — Clean Architecture & Layered Design
↓
docs/04-backend/02-clean-architecture.md
↓
Covered (created)

3) Chapter 3 — Modular Monolith Architecture
↓
docs/04-backend/03-modular-monolith.md
↓
Covered (created)

4) Chapter 4 — Domain-Driven Design (DDD)
↓
docs/04-backend/04-domain-driven-design.md
↓
Covered (created)

5) Chapter 5 — Dependency Injection & IoC
↓
docs/04-backend/05-dependency-injection-ioc.md
↓
Covered (created)

6) Chapter 6 — API Design Standards
and
7) Chapter 7 — REST API Architecture
↓
docs/04-backend/06-api-design-standards.md
↓
Covered (created; consolidated chapters 6 & 7)

8) Chapter 8 — Authentication & Authorization Flow
↓
docs/04-backend/07-authentication-and-authorization.md
↓
Covered (created). Cross-links to docs/06-security.

9) Chapter 9 — Service Layer Design
↓
docs/04-backend/08-service-layer-design.md
↓
Covered (created)

10) Chapter 10 — Repository Pattern
↓
docs/04-backend/09-repository-pattern.md
↓
Covered (created)

11) Chapter 11 — Validation Strategy
↓
docs/04-backend/10-validation-strategy.md
↓
Covered (created)

12) Chapter 12 — Error Handling Framework
↓
docs/04-backend/11-error-handling-framework.md
↓
Covered (created)

13) Chapter 13 — Event-Driven Architecture
↓
docs/04-backend/12-event-driven-architecture.md
↓
Covered (created)

14) Chapter 14 — Background Jobs & Queue Processing
↓
docs/04-backend/13-background-jobs-queue-processing.md
↓
Covered (created)

15) Chapter 15 — File Storage Architecture
↓
docs/04-backend/14-file-storage-architecture.md
↓
Covered (created)

16) Chapter 16 — Notification Framework
↓
docs/04-backend/15-notification-framework.md
↓
Covered (created)

17) Chapter 17 — Logging & Observability
↓
docs/04-backend/16-logging-and-observability.md
↓
Covered (created)

18) Chapter 18 — Caching Strategy
↓
docs/04-backend/17-caching-strategy.md
↓
Covered (created)

19) Chapter 19 — Configuration Management
↓
docs/04-backend/18-configuration-management.md
↓
Covered (created)

20) Chapter 20 — Testing Strategy
↓
docs/04-backend/19-testing-strategy.md
↓
Covered (created)

21) Chapter 21 — Performance Optimization
↓
docs/04-backend/20-performance-optimization.md
↓
Covered (created)

22) Chapter 22 — Backend Security Best Practices
↓
docs/06-security/01-backend-security.md
↓
Covered (created under docs/06-security — canonical security domain)

23) Chapter 23 — Deployment Architecture
↓
docs/07-devops/01-deployment-architecture.md
↓
Covered (created under docs/07-devops — canonical devops domain)

24) Chapter 24 — Module Development Guidelines
↓
docs/04-backend/21-module-development-guidelines.md
↓
Covered (created)

25) Chapter 25 — Coding Standards
↓
docs/02-architecture/05-coding-standards.md
↓
Covered (created under docs/02-architecture — global canonical location)

26) Chapter 26 — Backend Governance
↓
docs/00-overview/02-governance.md
↓
Covered — merged into global governance document at docs/00-overview/02-governance.md (single source of truth)

27) Chapter 27 — Volume 3 Summary
↓
docs/04-backend/27-volume3-summary.md
↓
Covered (created)

Status Notes:
- Files were created only where no suitable existing authoritative document was found.
- Cross-cutting topics (Coding Standards, Governance, Security, Deployment) were placed in global domains (docs/02-architecture, docs/06-security, docs/07-devops) per refactoring rules.
- ADR placeholders created: ADR-0008 (Event Contracts), ADR-0009 (Token Strategy).

Next Steps:
- Run link/anchor validation across the docs tree.
- Create additional ADRs if required by ARB.
- Populate SLO numeric values and produce final traceability matrix if zero-loss per-paragraph mapping is requested.


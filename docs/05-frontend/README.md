# Frontend Architecture — Portal

## Purpose

This README is the frontend architecture portal. It provides the starting point for frontend design, development, review, and maintenance.

The documents in this directory define frontend architecture and engineering guidance. Where a more specific authoritative repository document establishes a constraint, that document governs the relevant decision.

## Scope

This directory covers:

- Flutter application architecture
- Technology stack
- Modular frontend architecture
- Project structure
- State management
- Dependency injection
- Navigation and routing
- API communication
- Design system
- Forms and data entry
- Tables and data presentation
- Offline-aware behavior
- Performance
- Dashboards
- Reporting
- Data visualization
- Notifications
- Localization
- Accessibility
- Frontend testing
- Development standards

## Audience

Frontend developers, architects, QA engineers, product owners, DevOps engineers, and technical writers.

## Status

**Active architecture documentation**

This directory is maintained as current repository documentation. Obsolete migration/volume-summary documents are not part of the active frontend document set.

## Architecture Principles

- API-first communication
- Modular design
- Clear responsibility boundaries
- Backend-authoritative business and security rules
- Offline-aware operation, not a fully offline ERP
- Accessibility by design
- Testability by design
- Performance measured before optimization
- Localization-ready architecture

## Document Structure

### Core

- [01-frontend-overview.md](01-frontend-overview.md) — Overview and high-level architecture
- [01-technology-stack.md](01-technology-stack.md) — Frontend technology stack

### Architecture & Patterns

- [02-flutter-architecture.md](02-flutter-architecture.md) — Flutter architecture
- [03-modular-frontend-architecture.md](03-modular-frontend-architecture.md) — Modular frontend design
- [04-project-structure.md](04-project-structure.md) — Project layout and organization
- [05-state-management.md](05-state-management.md) — Riverpod state-management guidance
- [06-dependency-injection.md](06-dependency-injection.md) — Dependency injection

### Navigation & Routing

- [07-navigation-architecture.md](07-navigation-architecture.md) — Navigation architecture
- [08-routing-strategy.md](08-routing-strategy.md) — Routing and deep-link principles

### Communication & UI

- [09-api-communication.md](09-api-communication.md) — Backend API communication
- [10-design-system.md](10-design-system.md) — Design system and reusable components
- [11-forms-and-data-entry.md](11-forms-and-data-entry.md) — Forms and data entry
- [12-tables-and-data-presentation.md](12-tables-and-data-presentation.md) — Tables and data presentation

### Offline & Performance

- [14-offline-support.md](14-offline-support.md) — Offline-aware behavior and local storage
- [15-performance-optimization.md](15-performance-optimization.md) — Frontend performance

### Dashboards & Reporting

- [16-dashboard-architecture.md](16-dashboard-architecture.md) — Dashboard architecture
- [17-reporting-framework.md](17-reporting-framework.md) — Reporting framework
- [18-data-visualization.md](18-data-visualization.md) — Data visualization

### Cross-Cutting & Quality

- [19-notification-system.md](19-notification-system.md) — Frontend notification system
- [20-localization.md](20-localization.md) — Localization and internationalization
- [21-accessibility.md](21-accessibility.md) — Accessibility
- [22-frontend-testing-strategy.md](22-frontend-testing-strategy.md) — Frontend testing
- [23-development-standards.md](23-development-standards.md) — Frontend development standards

## Authoritative Boundaries

The frontend is not the system of record for enterprise business state.

In particular:

- Backend APIs are the authoritative application boundary for business operations.
- Backend authorization is authoritative; hiding frontend navigation/actions is not security.
- Backend validation and domain rules remain authoritative.
- Frontend state and cache are not authoritative business data.
- Frontend file handling uses the established backend file-storage boundary.
- Reporting calculations and authoritative business data come from backend/reporting contracts.

## Cross-References

- [Backend Architecture](../04-backend/README.md)
- [Backend API Design Standards](../04-backend/06-api-design-standards.md)
- [Backend Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)
- [Backend Testing Strategy](../04-backend/19-testing-strategy.md)
- [Security Documentation](../06-security/README.md)
- [DevOps Documentation](../07-devops/README.md)
- [ADR Documentation](../10-adr/README.md)

## Maintenance Rules

- Update the canonical document when an architectural decision changes.
- Do not retain obsolete migration metadata in active frontend documents.
- Do not create duplicate documents for the same architectural concern without first resolving ownership.
- Do not invent implementation details that have not been established by the repository.
- When a requirement is unclear, stop and resolve the ambiguity before encoding it as architecture.

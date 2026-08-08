# Frontend Architecture — Portal

Purpose

This README is the frontend architecture portal. It provides high-level purpose, navigation, and links to canonical frontend documents. Use this page as the starting point for frontend design, development and reviews.

Scope

Covers architecture, UI framework, state management, navigation, APIs, performance, offline, dashboards, visualization, testing and frontend engineering standards.

Audience

Frontend developers, architects, QA, product owners, DevOps, and technical writers.

Owner

TBD

Status

Migrated (Draft) — 2026-08-07

Architecture Principles (Frontend)

- API-First Communication
- Modular Design
- Single Responsibility for Widgets
- Offline-Aware (not fully offline)
- Accessibility-First
- Testability by Design
- Performance: measure before optimizing
- Localization-Ready

Document Structure (grouped for discoverability)

Core
- [01-frontend-overview.md](01-frontend-overview.md) — Overview & high-level architecture
- [01-technology-stack.md](01-technology-stack.md) — Technology stack (existing)

Architecture & Patterns
- [02-flutter-architecture.md](02-flutter-architecture.md) — Flutter specific architecture
- [03-modular-frontend-architecture.md](03-modular-frontend-architecture.md) — Modular design & modules
- [04-project-structure.md](04-project-structure.md) — Project layout and organization
- [06-dependency-injection.md](06-dependency-injection.md) — DI patterns
- [05-state-management.md](05-state-management.md) — State management (Riverpod)

Navigation & Routing
- [07-navigation-architecture.md](07-navigation-architecture.md) — Navigation patterns
- [08-routing-strategy.md](08-routing-strategy.md) — Routing strategy and deep links

UI Framework
- [10-design-system.md](10-design-system.md) — Design tokens, components and theming
- [11-forms-and-data-entry.md](11-forms-and-data-entry.md) — Forms, validation, drafts
- [12-tables-and-data-presentation.md](12-tables-and-data-presentation.md) — Tables, virtualization, pagination

Offline & Performance
- [14-offline-support.md](14-offline-support.md) — Offline-aware patterns & sync
- [15-performance-optimization.md](15-performance-optimization.md) — Lazy loading, rendering, monitoring

Dashboards & Reporting
- [16-dashboard-architecture.md](16-dashboard-architecture.md) — Dashboard components & personalization
- [17-reporting-framework.md](17-reporting-framework.md) — Reporting UX and structure
- [18-data-visualization.md](18-data-visualization.md) — Charts and KPI visualizations

Cross-cutting & Quality
- [19-notification-system.md](19-notification-system.md) — Notification UX (frontend)
- [20-localization.md](20-localization.md) — Localization & i18n
- [21-accessibility.md](21-accessibility.md) — Accessibility guidelines
- [22-frontend-testing-strategy.md](22-frontend-testing-strategy.md) — Testing strategy
- [23-development-standards.md](23-development-standards.md) — Coding standards and reviews

Summary & Traceability
- [24-volume4-summary.md](24-volume4-summary.md) — Volume 4 summary and decisions
- [../migration-traceability/volume4-to-docs.md](../migration-traceability/volume4-to-docs.md) — Authoritative mapping (single source)

Cross-References (canonical)
- Security: [../06-security/02-frontend-security.md](../06-security/02-frontend-security.md)
- Backend API standards: [../04-backend/06-api-design-standards.md](../04-backend/06-api-design-standards.md)
- DevOps / CI: [../07-devops/README.md](../07-devops/README.md)
- ADRs: [../10-adr/README.md](../10-adr/README.md)

Diagrams (placeholders)

Each major document should list required diagrams. Example placeholders:
- C4 Container Diagram: docs/assets/diagrams/frontend-c4-container.png (placeholder)
- Sequence Diagram (Login): docs/assets/diagrams/frontend-login-sequence.png (placeholder)
- State Diagram (Auth/Caching): docs/assets/diagrams/frontend-auth-state.png (placeholder)

How to contribute

- Update the canonical document directly (preserve history).
- If introducing a new frontend topic, discuss on the Architecture Review Board before creating a new canonical file.
- For UI changes, add/maintain component docs under docs/05-frontend/components/ when appropriate.

Latest migration notes

- Per-file traceability HTML comments were removed; use docs/migration-traceability/volume4-to-docs.md as the central mapping file.
- Metadata headers were added to frontend documents (Title, Purpose, Scope, Owner, Status, Last Reviewed).

If you need a different grouping (fewer files or folders), confirm before a structural reorganization — recommended to defer major consolidations until all volumes are migrated.

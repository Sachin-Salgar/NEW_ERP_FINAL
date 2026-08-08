# Volume 4 → docs/ Mapping

This file provides the authoritative Phase 1 mapping from Enterprise ERP Architecture Volume 4 (Frontend Architecture) chapters to canonical documents in the repository.

Note: Per-file traceability HTML comments have been removed from docs/05-frontend files. Use this central mapping (docs/migration-traceability/volume4-to-docs.md) as the single source of truth for Volume 4 → docs mapping.

Format: Volume 4 Chapter → Destination File → Status (Covered / Create / Cross-reference)

1) Chapter 1 — Frontend Architecture Overview
↓
docs/05-frontend/01-frontend-overview.md
↓
Covered — created from Volume 4 (verbatim)

2) Chapter 2 — Flutter Architecture
↓
docs/05-frontend/02-flutter-architecture.md
↓
Covered — created from Volume 4 (verbatim)

3) Chapter 3 — Modular Frontend Architecture
↓
docs/05-frontend/03-modular-frontend-architecture.md
↓
Covered — created from Volume 4 (verbatim)

4) Chapter 4 — Project Structure
↓
docs/05-frontend/04-project-structure.md
↓
Covered — created from Volume 4 (verbatim)

5) Chapter 5 — State Management (Riverpod)
↓
docs/05-frontend/05-state-management.md
↓
Covered — created from Volume 4 (verbatim)

6) Chapter 6 — Dependency Injection
↓
docs/05-frontend/06-dependency-injection.md
↓
Covered — created from Volume 4 (verbatim)

7) Chapter 7 — Navigation Architecture
↓
docs/05-frontend/07-navigation-architecture.md
↓
Covered — created from Volume 4 (verbatim)

8) Chapter 8 — Routing Strategy
↓
docs/05-frontend/08-routing-strategy.md
↓
Covered — created from Volume 4 (verbatim)

9) Chapter 9 — API Communication
↓
docs/05-frontend/09-api-communication.md
↓
Covered — created from Volume 4 (verbatim). Cross-referenced docs/04-backend/06-api-design-standards.md for API contract expectations.

10) Chapter 10 — User Interface Design System
↓
docs/05-frontend/10-design-system.md
↓
Covered — created from Volume 4 (verbatim)

11) Chapter 11 — Forms & Data Entry
↓
docs/05-frontend/11-forms-and-data-entry.md
↓
Covered — created from Volume 4 (verbatim)

12) Chapter 12 — Tables, Lists & Data Presentation
↓
docs/05-frontend/12-tables-and-data-presentation.md
↓
Covered — created from Volume 4 (verbatim)

13) Chapter 13 — Frontend Security
↓
docs/06-security/02-frontend-security.md
↓
Covered — created under canonical security folder (docs/06-security/02-frontend-security.md) and cross-referenced from docs/05-frontend

14) Chapter 14 — Offline Support & Local Storage
↓
docs/05-frontend/14-offline-support.md
↓
Covered — created from Volume 4 (verbatim)

15) Chapter 15 — Frontend Performance Optimization
↓
docs/05-frontend/15-performance-optimization.md
↓
Covered — created from Volume 4 (verbatim)

16) Chapter 16 — Dashboard Architecture
↓
docs/05-frontend/16-dashboard-architecture.md
↓
Covered — created from Volume 4 (verbatim)

17) Chapter 17 — Reporting Framework
↓
docs/05-frontend/17-reporting-framework.md
↓
Covered — created from Volume 4 (verbatim). Note: reporting has cross-cutting backend concerns; cross-reference docs/04-backend reporting or platform services where applicable.

18) Chapter 18 — Data Visualization
↓
docs/05-frontend/18-data-visualization.md
↓
Covered — created from Volume 4 (verbatim)

19) Chapter 19 — Notification System
↓
docs/05-frontend/19-notification-system.md
↓
Covered — created from Volume 4 (verbatim). Cross-referenced backend notification framework: docs/04-backend/15-notification-framework.md

20) Chapter 20 — Localization & Internationalization
↓
docs/05-frontend/20-localization.md
↓
Covered — created from Volume 4 (verbatim)

21) Chapter 21 — Accessibility
↓
docs/05-frontend/21-accessibility.md
↓
Covered — created from Volume 4 (verbatim)

22) Chapter 22 — Frontend Testing Strategy
↓
docs/05-frontend/22-frontend-testing-strategy.md
↓
Covered — created from Volume 4 (verbatim). Cross-reference CI/CD in docs/07-devops where required.

23) Chapter 23 — Frontend Development Standards
↓
docs/05-frontend/23-development-standards.md
↓
Covered — created from Volume 4 (verbatim). Cross-referenced global coding standards: docs/02-architecture/05-coding-standards.md

24) Chapter 24 — Volume 4 Summary
↓
docs/05-frontend/24-volume4-summary.md
↓
Covered — created from Volume 4 (verbatim). Cross-referenced docs/05-frontend/01-frontend-overview.md and docs/migration-traceability/volume4-to-docs.md

Status Notes:
- Existing frontend files found: docs/05-frontend/README.md and docs/05-frontend/01-technology-stack.md
  - Chapter(s) that map to existing technology stack: Chapter 24 (Technology Stack) → docs/05-frontend/01-technology-stack.md (Covered)
- Cross-cutting topics (security, API contracts, notifications, reporting) are mapped to canonical locations as appropriate and will include cross-reference links.

Next steps after this mapping is approved:
- Create the new frontend files (only those marked Create) using verbatim content from Volume 4, adding a traceability header to each created file.
- Place frontend security content under docs/06-security/02-frontend-security.md (canonical security domain) and cross-link from docs/05-frontend.
- Update docs/05-frontend/README.md to list new documents and cross references.
- Update docs/migration-traceability/volume4-to-docs.md with final file creation status and any ADRs discovered.

If you approve this mapping, I will create the new files (verbatim from Volume 4) with a short traceability header and update the frontend README and migration-traceability status entries.
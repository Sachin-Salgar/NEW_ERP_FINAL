# Volume 4 → docs/ Mapping

This file records the migration relationship from Enterprise ERP Architecture Volume 4 (Frontend Architecture) to the current canonical frontend and cross-cutting documentation.

The Volume 4 source was the basis for the initial document creation. The destination documents have since been independently audited and corrected; therefore this mapping must not describe the current files as "verbatim" copies of Volume 4.

Per-file traceability comments are not required in the destination documents. This file is the central Volume 4 mapping artifact.

## Chapter-level mapping

| Chapter | Source topic | Current canonical destination | Status |
|---:|---|---|---|
| 1 | Frontend Architecture Overview | `docs/05-frontend/01-frontend-overview.md` | Covered; audited |
| 2 | Flutter Architecture | `docs/05-frontend/02-flutter-architecture.md` | Covered; audited |
| 3 | Modular Frontend Architecture | `docs/05-frontend/03-modular-frontend-architecture.md` | Covered; audited |
| 4 | Project Structure | `docs/05-frontend/04-project-structure.md` | Covered; audited |
| 5 | State Management (Riverpod) | `docs/05-frontend/05-state-management.md` | Covered; audited |
| 6 | Dependency Injection | `docs/05-frontend/06-dependency-injection.md` | Covered; audited |
| 7 | Navigation Architecture | `docs/05-frontend/07-navigation-architecture.md` | Covered; audited |
| 8 | Routing Strategy | `docs/05-frontend/08-routing-strategy.md` | Covered; audited |
| 9 | API Communication | `docs/05-frontend/09-api-communication.md` | Covered; audited; backend API contract cross-reference |
| 10 | User Interface Design System | `docs/05-frontend/10-design-system.md` | Covered; audited |
| 11 | Forms & Data Entry | `docs/05-frontend/11-forms-and-data-entry.md` | Covered; audited |
| 12 | Tables, Lists & Data Presentation | `docs/05-frontend/12-tables-and-data-presentation.md` | Covered; audited |
| 13 | Frontend Security | `docs/06-security/02-frontend-security.md` | Covered under canonical Security domain |
| 14 | Offline Support & Local Storage | `docs/05-frontend/14-offline-support.md` | Covered; audited |
| 15 | Frontend Performance Optimization | `docs/05-frontend/15-performance-optimization.md` | Covered; audited |
| 16 | Dashboard Architecture | `docs/05-frontend/16-dashboard-architecture.md` | Covered; audited |
| 17 | Reporting Framework | `docs/05-frontend/17-reporting-framework.md` | Covered; audited; cross-cutting backend/platform concerns remain in their canonical domains |
| 18 | Data Visualization | `docs/05-frontend/18-data-visualization.md` | Covered; audited |
| 19 | Notification System | `docs/05-frontend/19-notification-system.md` | Covered; audited; backend notification capability remains canonical in its backend/platform documents |
| 20 | Localization & Internationalization | `docs/05-frontend/20-localization.md` | Covered; audited; platform localization is canonical in `docs/09-platform-services/05-localization-internationalization.md` |
| 21 | Accessibility | `docs/05-frontend/21-accessibility.md` | Covered; audited |
| 22 | Frontend Testing Strategy | `docs/05-frontend/22-frontend-testing-strategy.md` | Covered; audited; CI/CD remains under DevOps |
| 23 | Frontend Development Standards | `docs/05-frontend/23-development-standards.md` | Covered; audited; global coding standards remain under `docs/02-architecture/05-coding-standards.md` |
| 24 | Volume 4 Summary | `docs/05-frontend/24-volume4-summary.md` | Covered; audited |

## Current canonical ownership rules

- Frontend implementation architecture is canonical under `docs/05-frontend`.
- Frontend security policy/control ownership is canonical under `docs/06-security/02-frontend-security.md` and the broader enterprise security architecture.
- Backend API contracts and backend implementation remain under `docs/04-backend`.
- Notification platform capability remains under the canonical platform/backend service documents.
- Platform-level localization capability is canonical under `docs/09-platform-services/05-localization-internationalization.md`; the frontend document defines frontend consumption.
- Global coding standards remain under `docs/02-architecture/05-coding-standards.md`.
- CI/CD and deployment remain under `docs/07-devops`.

## Migration status

The initial Volume 4 migration has been completed and the destination files have subsequently undergone repository-wide architectural audit. Historical statements that the files are exact/verbatim copies are therefore no longer authoritative.

No Volume 4 source archive is modified by this mapping document.

## AI / Copilot rule

AI-assisted implementation must use the current canonical destination documents rather than reconstructing implementation decisions from historical Volume 4 text. When current repository precedence does not resolve a conflict, AI must **STOP and ask** rather than inventing a frontend architectural decision.

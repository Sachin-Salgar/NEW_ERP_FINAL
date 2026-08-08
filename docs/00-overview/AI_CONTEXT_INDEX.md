# AI Context Index — Overview for Local Models

Purpose

This file is an index optimized for AI assistants and local semantic search. It lists the canonical topics and where they live in the repository so an assistant can quickly load a minimal context map.

Last Updated: 2026-08-08
Owner: Documentation Team (TBD)
Status: Draft

Core Topics (high level)

- Backend
  - Architecture: docs/02-architecture/02-system-architecture.md
  - API Standards: docs/04-backend/06-api-design-standards.md
  - Services: docs/04-backend/README.md
  - Notifications: docs/04-backend/15-notification-framework.md

- Frontend
  - Overview: docs/05-frontend/01-frontend-overview.md
  - Technology Stack: docs/05-frontend/01-technology-stack.md
  - State Management: docs/05-frontend/05-state-management.md
  - Navigation & Routing: docs/05-frontend/07-navigation-architecture.md, docs/05-frontend/08-routing-strategy.md
  - Design System: docs/05-frontend/10-design-system.md
  - Performance & Offline: docs/05-frontend/14-offline-support.md, docs/05-frontend/15-performance-optimization.md

- Database
  - Overview: docs/03-database/README.md
  - Data Categories: docs/03-database/13-data-categories.md

- Security
  - Canonical security docs: docs/06-security/README.md
  - Security Operations: docs/06-security/03-security-operations.md
  - Frontend Security: docs/06-security/02-frontend-security.md

- DevOps
  - Architecture: docs/07-devops/01-devops-architecture.md
  - Infrastructure: docs/07-devops/02-infrastructure-architecture.md
  - Environment Management: docs/07-devops/03-environment-management.md
  - Containerization: docs/07-devops/04-containerization.md
  - CI/CD Pipeline: docs/07-devops/05-ci-cd-pipeline.md
  - Reliability: docs/07-devops/06-reliability-fault-tolerance.md
  - Scalability: docs/07-devops/07-scalability.md
  - Observability: docs/07-devops/08-observability.md
  - Backup & DR: docs/07-devops/09-backup-disaster-recovery.md
  - Operations Management: docs/07-devops/11-operations-management.md

- Governance & Standards
  - Canonical governance: docs/00-overview/02-governance.md
  - Documentation Management: docs/00-overview/documentation-management.md
  - Coding Standards: docs/02-architecture/05-coding-standards.md
  - ADR Index: docs/10-adr/README.md

- ADRs
  - ADR list: docs/10-adr/README.md

- Migration Traceability
  - Volume 4 mapping: docs/migration-traceability/volume4-to-docs.md
  - Volume 3 mapping: docs/migration-traceability/volume3-to-docs.md

Guidance for AI assistants

- Load this file first to identify the canonical documents for each topic.
- Prefer canonical files (those under docs/, not docs/archive/) for authoritative content.
- Use ADR files to find decisions and status (Proposed, Accepted, Superseded).
- For cross-cutting concerns, consult the canonical folders: docs/02-architecture, docs/06-security, docs/07-devops.

Notes

- Keep this file minimal and update when documents are added or moved.
- This file is deliberately short to provide quick high-value context to local models.

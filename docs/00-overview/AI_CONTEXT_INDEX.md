# AI Context Index — Canonical Documentation Navigation

**Purpose**

This file is a human-maintained navigation index for AI assistants and semantic-search tooling. It identifies the canonical ERP documentation locations so an assistant can load minimal, relevant context instead of reading the entire repository.

**Last Updated:** 2026-08-18  
**Owner:** Architecture / Documentation Team  
**Status:** Authoritative navigation index

## Authority

This index is **navigation metadata**, not an independent source of architectural decisions.

- The current modular documentation under `docs/` is authoritative according to the source-of-truth rules in `docs/README.md` and `docs/00-overview/02-governance.md`.
- Approved ADRs under `docs/10-adr/` override conflicting architecture decisions only within their explicit scope.
- Proposed, superseded, and deprecated ADRs are not binding.
- `docs/archive/` does not exist and must not be recreated for legacy architecture material.
- Generated repository indexes under `.ai/generated/` describe repository facts and navigation; they do not override this documentation.

## Canonical Topics

### Vision & Architecture

- Vision: `docs/01-vision/`
- Core Architecture: `docs/02-architecture/`
- Architectural Principles: `docs/00-overview/01-architectural-principles.md`
- Governance: `docs/00-overview/02-governance.md`
- ADRs: `docs/10-adr/`

### Backend

- Backend Architecture: `docs/04-backend/README.md`
- Clean Architecture: `docs/04-backend/02-clean-architecture.md`
- Modular Monolith: `docs/04-backend/03-modular-monolith.md`
- API Standards: `docs/04-backend/06-api-design-standards.md`
- Authentication & Authorization: `docs/04-backend/07-authentication-and-authorization.md`
- Services: `docs/04-backend/08-service-layer-design.md`
- Testing: `docs/04-backend/19-testing-strategy.md`

### Frontend

- Frontend Architecture: `docs/05-frontend/`
- Technology Stack: `docs/05-frontend/01-technology-stack.md`
- State Management: `docs/05-frontend/05-state-management.md`
- Navigation & Routing: `docs/05-frontend/07-navigation-architecture.md`, `docs/05-frontend/08-routing-strategy.md`
- Design System: `docs/05-frontend/10-design-system.md`

### Database

- Database Architecture: `docs/03-database/README.md`
- Data Categories: `docs/03-database/13-data-categories.md`
- Tenancy / RLS: `docs/03-database/` and approved ADRs in `docs/10-adr/`

### Security

- Security Architecture: `docs/06-security/README.md`
- Backend Security: `docs/06-security/01-backend-security.md`
- Frontend Security: `docs/06-security/02-frontend-security.md`
- Security Operations: `docs/06-security/03-security-operations.md`

### DevOps

- DevOps Architecture: `docs/07-devops/`
- Deployment: `docs/07-devops/01-deployment-architecture.md`
- Infrastructure: `docs/07-devops/02-infrastructure-architecture.md`
- Environments: `docs/07-devops/03-environment-management.md`
- Containerization: `docs/07-devops/04-containerization.md`
- CI/CD: `docs/07-devops/05-ci-cd-pipeline.md`
- Observability: `docs/07-devops/08-observability.md`
- Backup & DR: `docs/07-devops/09-backup-disaster-recovery.md`

### Business Modules

- Module Architecture: `docs/08-business-modules/`
- Individual module specifications must be treated as authoritative within their stated scope.

### Platform Services

- Platform Architecture: `docs/09-platform-services/`
- Individual platform-service specifications must be treated as authoritative within their stated scope.

### Traceability

- Migration/traceability documents: `docs/migration-traceability/`

Traceability documents explain how prior architecture material was refactored into the current repository. They are not a competing architecture source.

## Guidance for AI Assistants

1. Start from this index to identify relevant canonical documentation.
2. Read `docs/README.md` and the relevant authoritative documents before implementing non-trivial changes.
3. Check applicable approved ADRs before accepting an architectural assumption.
4. Read only the relevant documentation and source files required by the task; do not indiscriminately load the entire repository.
5. If documentation is missing or contradictory, stop and surface the issue for human resolution.
6. Never treat source code as permission to override authoritative architecture.
7. Never treat a generated `.ai` index as an architectural decision source.

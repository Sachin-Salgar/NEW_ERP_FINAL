# NEW_ERP_FINAL Repository Map

## Repository root

| Path | Role | AI treatment |
|---|---|---|
| `docs/` | Authoritative ERP architecture and governance | Primary source of truth |
| `.ai/` | AI workflow/navigation artifacts | Workflow guidance, not ERP authority |
| `.github/` | GitHub/Copilot integration | AI tooling configuration |
| `Version 1.1.0` | Repository-level version/reference artifact | Inspect only when relevant |
| `README.md` | Repository entry point | Context only |
| `LICENSE` | Licensing | Do not use as ERP design authority |

## Documentation domains

| Domain | Path | Use when task concerns |
|---|---|---|
| Overview/governance | `docs/00-overview/` | authority, principles, governance, document control |
| Vision | `docs/01-vision/` | scope, objectives, business direction |
| Architecture | `docs/02-architecture/` | system architecture, layers, modules, boundaries |
| Database | `docs/03-database/` | schema, database standards, persistence, tenancy |
| Backend | `docs/04-backend/` | backend runtime, service design, APIs, backend standards |
| Frontend | `docs/05-frontend/` | UI/frontend architecture and standards |
| Security | `docs/06-security/` | authentication, authorization, security controls |
| DevOps | `docs/07-devops/` | deployment, infrastructure, CI/CD, operations |
| Business modules | `docs/08-business-modules/` | business-domain/module behavior |
| Platform services | `docs/09-platform-services/` | shared enterprise/platform capabilities |
| ADRs | `docs/10-adr/` | approved architectural decisions and exceptions |
| Archive | `docs/archive/` | historical/reference material only |
| Assets | `docs/assets/` | diagrams and supporting artifacts |
| Migration traceability | `docs/migration-traceability/` | migration/audit traceability |

## Documentation entry points

Start every repository-level task with:

1. `docs/README.md`
2. `docs/00-overview/02-governance.md`
3. the relevant domain README(s)
4. relevant approved ADRs

Do not read every document by default. Follow the domain map and task dependencies.

## Current implementation visibility

This branch currently serves as the AI-workflow construction branch. The AI must inspect the actual implementation tree before assuming that backend/frontend/database source directories exist or are complete.

When implementation is added, update this map only when a stable repository structure or module boundary has been established. Do not use the map as a substitute for inspecting actual source files.

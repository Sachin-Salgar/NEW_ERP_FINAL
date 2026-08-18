# Volume 6 — Owner Resolutions

This file records the canonical ownership dispositions established during the Volume 6 reconciliation. It is a traceability artifact; the current canonical documents under `docs/` are authoritative for implementation and architecture.

## 1. Core Enterprise / Identity & RBAC
- Policy and security controls: `docs/06-security/04-enterprise-security-architecture.md`
- Backend authentication/authorization implementation patterns: `docs/04-backend/07-authentication-and-authorization.md`
- Module-level identity and RBAC usage: `docs/08-business-modules/02-core-enterprise-modules.md`
- Module contract/integration guidance: `docs/04-backend/21-module-development-guidelines.md`
- Disposition: KEEP + CROSS-REFERENCE

## 2. Workflow / BPM
- Workflow engine/platform capability: `docs/09-platform-services/01-platform-service-architecture.md`
- Business workflow/BPM usage: `docs/08-business-modules/14-workflow-bpm-module-architecture.md`
- Module contract/integration: `docs/04-backend/21-module-development-guidelines.md`
- Disposition: KEEP + CROSS-REFERENCE

## 3. BI / Analytics / EDW
- Master-data and data-governance ownership: `docs/03-database/20-master-data-management.md`
- BI/analytics architecture: `docs/08-business-modules/13-bi-analytics-module-architecture.md`
- Platform delivery capabilities are referenced from `docs/09-platform-services/01-platform-service-architecture.md` where applicable.
- Disposition: KEEP + CROSS-REFERENCE

## 4. AI Platform / MLOps
- AI platform architecture: `docs/09-platform-services/03-ai-platform-architecture.md`
- Security policy and controls: `docs/06-security/04-enterprise-security-architecture.md`
- Training-data/master-data governance: `docs/03-database/20-master-data-management.md`
- Disposition: KEEP + CROSS-REFERENCE

## 5. Platform Configuration and Localization
The earlier migration record described these two documents as deprecated placeholders. That statement is no longer correct.

The current repository contains and actively uses:

- `docs/09-platform-services/04-enterprise-configuration-framework.md`
- `docs/09-platform-services/05-localization-internationalization.md`

Both are now canonical platform-service documents and were independently audited during the repository documentation audit. They must therefore remain in the canonical mapping.

- Enterprise configuration: `docs/09-platform-services/04-enterprise-configuration-framework.md`
- Localization/internationalization: `docs/09-platform-services/05-localization-internationalization.md`
- Frontend localization remains a consumer/implementation concern under `docs/05-frontend/20-localization.md`.
- Disposition: KEEP + CROSS-REFERENCE

## 6. Project Management Module
The original Volume 6 migration created a Project Management destination. The repository architecture has since made an explicit decision to remove Project Management completely.

The current canonical repository therefore contains **no**:

`docs/08-business-modules/10-project-management-module-architecture.md`

Project Management must not be listed as an active business module, migration destination, dependency, or module-enableable capability in current canonical traceability.

This is a deliberate post-migration architecture change, not a missing-file error.

## 7. Current Traceability Rule
Migration documents describe historical source-to-canonical relationships. When a later explicit architectural decision changes the repository structure, the current canonical repository state takes precedence.

Accordingly:

- Historical source content remains traceable where the source existed.
- Deleted modules are not represented as active canonical modules.
- Canonical documents currently present in `docs/` are authoritative.
- A migration record must not claim that a file is deprecated when that file is currently canonical.
- A migration record must not claim that a deleted file remains an active destination.

## 8. AI / Copilot Rule
AI-assisted implementation must follow the current canonical documents rather than treating historical Volume 6 mapping statements as implementation authority.

When historical traceability conflicts with current canonical architecture, AI must use the current canonical architecture and **STOP and ask** when the intended resolution cannot be established from repository precedence.

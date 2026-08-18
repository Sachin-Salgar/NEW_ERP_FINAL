# Volume 7 → Docs Mapping

## Purpose

This file records the canonical migration relationship for Volume 7 (Chapters 181–189) into the repository documentation.

Source archive:
- `docs/archive/Enterprise ERP Software Architecture - Volume 7 – Enterprise Information & Platform Services.md`

The archive is historical source material and remains read-only. Current canonical documents under `docs/` take precedence over historical migration wording.

## Chapter-level mapping

| Chapter | Title | Canonical Destination | Current Disposition |
|---:|---|---|---|
| 181 | Enterprise Document Management | `docs/09-platform-services/01-platform-service-architecture.md` | MERGED / CANONICAL |
| 182 | File Storage & Object Repository | `docs/09-platform-services/01-platform-service-architecture.md`; `docs/04-backend/14-file-storage-architecture.md` | SPLIT BY OWNERSHIP |
| 183 | Document Versioning & Collaboration | `docs/09-platform-services/01-platform-service-architecture.md` | MERGED / CANONICAL |
| 184 | OCR, Document Intelligence & Content Extraction | `docs/09-platform-services/03-ai-platform-architecture.md` | CANONICAL AI CAPABILITY |
| 185 | Electronic Signatures & Digital Certificates | `docs/06-security/04-enterprise-security-architecture.md` | CANONICAL SECURITY CONCERN |
| 186 | Master Data Management (MDM) | `docs/03-database/20-master-data-management.md` | CANONICAL DATABASE / DATA-GOVERNANCE CONCERN |
| 187 | Reference Data & Code Management | `docs/03-database/20-master-data-management.md` | CANONICAL DATABASE / DATA-GOVERNANCE CONCERN |
| 188 | Enterprise Configuration Framework | `docs/09-platform-services/04-enterprise-configuration-framework.md` | CANONICAL PLATFORM SERVICE |
| 189 | Localization & Internationalization | `docs/09-platform-services/05-localization-internationalization.md` | CANONICAL PLATFORM SERVICE; FRONTEND CONSUMER |

## Ownership rules

- Platform-level document and workflow capabilities belong to Platform Services.
- Backend file-storage implementation remains under the Backend architecture.
- Security policy and controls remain under the Security domain.
- Master data and reference-data governance remain under the Database/data-governance domain.
- AI platform architecture remains under Platform Services with security and data-governance constraints.
- Enterprise configuration and localization are active canonical platform-service documents in the current repository; they are not deprecated placeholders.
- Frontend localization remains a consumer implementation concern under `docs/05-frontend/20-localization.md`.

## Cross-reference guidance

Consumer documents should reference the canonical owner rather than duplicate authoritative policy or architecture. Current canonical documents may contain implementation-specific detail appropriate to their domain while retaining cross-references to the owning document.

## Validation notes

The original migration record referenced additional Volume 7 traceability artifacts:

- `docs/migration-traceability/volume7-content-conservation.md`
- `docs/migration-traceability/volume7-owner-resolutions.md`
- `docs/migration-traceability/volume7-completion-audit.md`

Those three files are **not present on `ai/repository-aware-development`**. They therefore must not be presented as existing validation artifacts. This mapping document is the currently verified Volume 7 mapping artifact.

No archival source is modified by this document.

## AI / Copilot rule

AI-assisted implementation must use the current canonical destination documents as implementation authority. Historical Volume 7 wording is traceability evidence, not permission to recreate superseded architecture.

If a conflict cannot be resolved from current repository precedence, AI must **STOP and ask** rather than inventing a migration decision.

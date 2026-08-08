# Volume 7 → Docs mapping

Purpose
- Document the canonical migration of Volume 7 (Chapters 181–189) into the repository canonical documentation.
- Preserve all substantive architecture from the Volume 7 archive (docs/archive/Enterprise ERP Software Architecture - Volume 7 – Enterprise Information & Platform Services.md).

Source archive:
- docs/archive/Enterprise ERP Software Architecture - Volume 7 – Enterprise Information & Platform Services.md

Immutable-source rule: the archive remains read-only and unchanged.

Canonical ownership rules: follow repository precedence (Platform Services, Database/MDM, Security, Backend, Frontend, DevOps, Business Modules, ADRs).

## Chapter-level mapping (summary)

| Chapter | Title | Canonical Destination | Disposition |
|---:|---|---|---|
| 181 | Enterprise Document Management | docs/09-platform-services/01-platform-service-architecture.md | MERGED / EXTENDED (Platform Services canonical) |
| 182 | File Storage & Object Repository | docs/09-platform-services/01-platform-service-architecture.md; docs/04-backend/14-file-storage-architecture.md | SPLIT (platform-level + backend implementation) |
| 183 | Document Versioning & Collaboration | docs/09-platform-services/01-platform-service-architecture.md | MERGED / EXTENDED |
| 184 | OCR, Document Intelligence & Content Extraction | docs/09-platform-services/03-ai-platform-architecture.md | CANONICALIZE (AI Platform) |
| 185 | Electronic Signatures & Digital Certificates | docs/06-security/04-enterprise-security-architecture.md | CANONICALIZE (Security) |
| 186 | Master Data Management (MDM) | docs/03-database/20-master-data-management.md | MERGED / EXTENDED (Database canonical) |
| 187 | Reference Data & Code Management | docs/03-database/20-master-data-management.md | MERGED / EXTENDED (Database canonical) |
| 188 | Enterprise Configuration Framework | docs/09-platform-services/04-enterprise-configuration-framework.md | CANONICALIZED (Platform canonical; placeholder reactivated) |
| 189 | Localization & Internationalization | docs/09-platform-services/05-localization-internationalization.md | CANONICALIZED (Platform canonical; frontend remains consumer) |

Disposition definitions
- MERGED / EXTENDED: Content merged into an existing canonical file and extended where needed.
- SPLIT: Platform-level concepts retained in platform canonicals; implementation mechanics retained in implementation doc(s).
- CANONICALIZE: Reactivated or created canonical file assigned ownership.

Cross-reference guidance
- Where platform services consume security, MDM, AI, or backend implementation, files include explicit cross-references to the canonical owner files.

Owner-review items
- None required for chapter-level ownership; specific subsection-level items are listed in the content conservation matrix.

Validation criteria
- All numbered sections 181.1..189.10 are accounted for in the content-conservation artifact.
- No archival source was modified.
- Canonical ownership established according to repository precedence.

For full per-section mapping and evidence, see:
- docs/migration-traceability/volume7-content-conservation.md
- docs/migration-traceability/volume7-owner-resolutions.md
- docs/migration-traceability/volume7-completion-audit.md

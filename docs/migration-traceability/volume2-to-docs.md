# Traceability: Volume 2 → docs/

This file maps every top-level chapter in the original
"Enterprise ERP Software Architecture -Volume 2-Database Architecture & Standards.md"
to its canonical destination file under docs/03-database.

Format: Original Chapter (Volume 2) -> Destination file (docs/03-database/) -> Status

---

Chapter 1 — Database Vision -> docs/03-database/01-vision-principles.md -> PASS
Chapter 2 — Database Design Principles -> docs/03-database/01-vision-principles.md -> PASS
Chapter 3 — Data Ownership -> docs/03-database/02-data-ownership.md -> PASS
Chapter 4 — Naming Conventions -> docs/03-database/03-naming-conventions.md -> PASS
Chapter 5 — Schema Organization -> docs/03-database/04-schema-organization.md -> PASS
Chapter 6 — Data Types -> docs/03-database/05-data-types.md -> PASS
Chapter 7 — Primary Keys -> docs/03-database/06-primary-keys.md -> PASS (linked to ADR-0005)
Chapter 8 — Foreign Keys -> docs/03-database/07-referential-integrity.md -> PASS (file renamed for canonical naming)
Chapter 9 — Audit Columns -> docs/03-database/08-audit-lifecycle.md -> PASS
Chapter 10 — Soft Deletes -> docs/03-database/09-soft-delete-retention.md -> PASS
Chapter 11 — Versioning -> docs/03-database/10-concurrency-control.md -> PASS
Chapter 12 — Multi-Tenant Architecture -> docs/03-database/11-multi-tenancy.md -> PASS (linked to ADR-0006)
Chapter 13 — Organization Isolation -> docs/03-database/12-organizational-isolation.md -> PASS
Chapter 14 — Shared Data -> docs/03-database/13-data-categories.md -> PASS
Chapter 15 — Master Data -> docs/03-database/13-data-categories.md -> PASS
Chapter 16 — Transaction Data -> docs/03-database/13-data-categories.md -> PASS
Chapter 17 — Index Strategy -> docs/03-database/14-performance-optimization.md -> PASS
Chapter 18 — Query Optimization / Constraints -> docs/03-database/14-performance-optimization.md and docs/03-database/?? (constraints guidance embedded) -> PARTIAL
Chapter 19 — Normalization & Denormalization -> docs/03-database/15-scalability-archival.md -> PASS
Chapter 20 — Partitioning -> docs/03-database/15-scalability-archival.md -> PASS
Chapter 21 — Archival -> docs/03-database/15-scalability-archival.md -> PASS
Chapter 22 — Transactions & Backup Strategy -> docs/03-database/17-backup-recovery.md -> PARTIAL (backup present; cross-reference to transaction retention needed)
Chapter 23 — Security -> docs/03-database/16-security-architecture.md -> PASS
Chapter 24 — Migration Strategy -> docs/03-database/18-lifecycle-governance.md -> PASS (linked to ADR-0007)
Chapter 25 — Seed Data -> docs/03-database/18-lifecycle-governance.md -> PARTIAL (seed data guidance present but not standalone)
Chapter 26 — Governance & Roles -> docs/03-database/18-lifecycle-governance.md -> PASS
Chapter 27 — Decisions Established -> docs/10-adr/README.md and docs/03-database/* -> PASS
Chapter 28 — Testing -> docs/03-database/18-lifecycle-governance.md and appendix-templates.md -> PARTIAL
Chapter 29 — Documentation -> docs/03-database/README.md and appendix-templates.md -> PASS

Notes:
- Some chapters are split across multiple docs/ files where appropriate (e.g., performance and constraints). The original Volume 2 TOC/body numbering drift has been reconciled by mapping chapters to logical destination files. The audit requires a per-heading/per-paragraph matrix for full zero-tolerance validation; request if required.

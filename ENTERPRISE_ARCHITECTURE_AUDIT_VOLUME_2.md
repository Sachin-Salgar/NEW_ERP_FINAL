# Enterprise Architecture Audit — Volume 2

Source document: `Enterprise ERP Software Architecture -Volume 2-Database Architecture & Standards.md`

Audit scope for this deliverable: Volume 2 only, lines 1–4092. Volume 1 cross-reference validation is included where contradictions or continuations are visible. Volumes 3–7 remain pending.

## Audit Log

- Last Volume: Volume 2 — Database Architecture & Standards
- Last Chapter: Appendices / End of Document
- Last Section: Appendix A / End of Volume 2
- Last Heading: End of Volume 2
- Last Reviewed Line: 4092
- Pending Items: Volumes 3–7, deeper cross-volume validation against backend/frontend/devops/module/platform-service documents, final scoring after all volumes are audited.

---

## Findings

### Finding V2-001

Volume: Volume 2

Chapter: Document Header / Table of Contents

Section: Header and TOC

Heading: Enterprise ERP Software Architecture Document / Table of Contents

Paragraph: Lines 1–52

Line Reference: Lines 1–52

Severity: MAJOR

Category: Documentation quality, governance, maintainability, naming consistency

Current Text: The document declares the database architecture standard, ADR deviation rule, and a table of contents listing Chapters 1–29.

Problem: The table of contents does not match the body. The body later labels backup as Chapter 22 and security as Chapter 23, then migration as Chapter 24, skips Chapter 25, and uses Chapters 26 and 27 for governance/conclusion. The TOC says Chapter 24 Backup Strategy, Chapter 25 Disaster Recovery, Chapter 26 Migration Strategy, Chapter 27 Seed Data, Chapter 28 Testing, and Chapter 29 Documentation.

Reason: Architecture documentation must be navigable and internally consistent. Chapter-number drift breaks traceability and makes audit references unreliable.

Enterprise Impact: Database engineers, DBAs, auditors, and implementation teams may reference the wrong chapter for backup, DR, migration, testing, and documentation standards.

Recommendation: Reconcile the TOC and body. Either restore Chapters 24–29 as listed or update the TOC to the actual body structure. Add stable anchors and a generated TOC.

Improved Version: `Chapter 22 Backup Strategy; Chapter 23 Database Security; Chapter 24 Migration Strategy; Chapter 25 Disaster Recovery; Chapter 26 Database Governance; Chapter 27 Conclusion; Appendix A Database Checklist`, or renumber the body to match the original TOC.

Related Sections: Volume 2 lines 3433–3864; Volume 1 governance lines 370–376.

---

### Finding V2-002

Volume: Volume 2

Chapter: Chapter 1 — Database Vision

Section: 1.1–1.4

Heading: Database Vision, Purpose, Source of Truth, Data Integrity

Paragraph: Lines 58–92

Line Reference: Lines 58–92

Severity: GOOD PRACTICE

Category: Database architecture, integrity, security, enterprise best practices

Current Text: The database is positioned as the ERP foundation, source of truth, and protector of business data through keys, constraints, transactions, referential integrity, and controlled updates.

Problem: No issue with the core principle.

Reason: ERP correctness depends on durable, relational, auditable records. The explicit emphasis on primary keys, foreign keys, unique constraints, check constraints, transactions, and referential integrity is technically correct for a PostgreSQL-backed ERP.

Enterprise Benefit: Reduces data corruption risk, improves auditability, and supports financial, inventory, payroll, and compliance correctness.

Recommendation: Retain this principle and ensure every module schema is validated against it in CI.

Improved Version: No wording change required; add automated schema linting and migration checks.

Related Sections: Volume 1 lines 154–158 and 336–338.

---

### Finding V2-003

Volume: Volume 2

Chapter: Chapter 1 — Database Vision

Section: 1.6 Scalability

Heading: 1.6 Scalability

Paragraph: Lines 99–111

Line Reference: Lines 99–111

Severity: MAJOR

Category: Performance, scalability, capacity planning

Current Text: The database should support millions of records while maintaining acceptable performance.

Problem: `Millions of records` and `acceptable performance` are not measurable architecture requirements.

Reason: Database scalability depends on row counts per table, tenant count, write throughput, query mix, retention period, partition strategy, index design, reporting workload, hardware, and concurrency.

Enterprise Impact: Teams cannot size infrastructure, design partitioning, benchmark query plans, or define acceptance criteria.

Recommendation: Replace qualitative language with tiered capacity targets and measurable SLOs.

Improved Version: `For each deployment tier, define maximum tenants, organizations, active users, transactions/day, largest table size, retention period, p95 query latency, backup window, restore target, and reporting workload limits.`

Related Sections: Volume 1 lines 95 and 115; Volume 2 lines 2685–2804 and 3038–3179.

---

### Finding V2-004

Volume: Volume 2

Chapter: Chapter 1 — Database Vision

Section: 1.8 Security

Heading: 1.8 Security

Paragraph: Lines 121–130

Line Reference: Lines 121–130

Severity: MAJOR

Category: Security, encryption, compliance, database administration

Current Text: Security covers role separation, least privilege, secure connections, encryption where appropriate, audit logging, and controlled administrative access.

Problem: The phrase `encryption where appropriate` is too weak for enterprise ERP. The section does not define encryption at rest, backup encryption, key management, column-level protection, secrets handling, privileged access management, RLS, or masking.

Reason: ERP databases contain financial, HR, payroll, customer, supplier, and potentially regulated personal data.

Enterprise Impact: Ambiguous encryption and access standards create breach, regulatory, and audit risk.

Recommendation: Define mandatory TLS in transit, encryption at rest, encrypted backups, KMS/HSM-backed key rotation, column-level encryption criteria, secrets management, RLS policy, and privileged access logging.

Improved Version: `All database connections shall use TLS; production storage and backups shall be encrypted; sensitive columns shall follow approved protection, masking, and key-management standards; privileged access shall be time-bound and audited.`

Related Sections: Volume 2 lines 3433–3566.

---

### Finding V2-005

Volume: Volume 2

Chapter: Chapter 2 — Database Design Principles

Section: 2.2 Business Before Technology

Heading: 2.2 Business Before Technology

Paragraph: Lines 144–158

Line Reference: Lines 144–158

Severity: GOOD PRACTICE

Category: DDD compliance, normalization, maintainability

Current Text: Tables shall model business concepts rather than application screens, with examples such as Customer, Supplier, Invoice, Purchase Order, and Warehouse.

Problem: No issue with the principle.

Reason: Modeling persistent data around business concepts rather than UI screens aligns with DDD and prevents schema churn driven by frontend layout changes.

Enterprise Benefit: Improves schema stability, domain clarity, reporting consistency, and module longevity.

Recommendation: Add bounded-context ownership for shared terms such as Customer, Supplier, and Warehouse.

Improved Version: Keep current text and add owner/context metadata for each entity.

Related Sections: Volume 2 lines 232–508.

---

### Finding V2-006

Volume: Volume 2

Chapter: Chapter 2 — Database Design Principles

Section: 2.5–2.6 Controlled Redundancy and Immutable Business History

Heading: Controlled Redundancy / Immutable Business History

Paragraph: Lines 180–198

Line Reference: Lines 180–198

Severity: GOOD PRACTICE

Category: Auditability, financial correctness, regulatory compliance

Current Text: Data duplication is generally avoided but allowed for historical accuracy, reporting performance, audit preservation, and regulatory compliance; corrections generally use reversing entries.

Problem: No issue with the principle.

Reason: ERP financial and inventory records must preserve posted historical facts even when master data changes later.

Enterprise Benefit: Supports audit trails, accounting correctness, and historical reporting.

Recommendation: Define exact immutable states and reversal workflows per module in Volume 6.

Improved Version: Keep current text and add module-specific posting/reversal state machines.

Related Sections: Volume 2 lines 2615–2653.

---

### Finding V2-007

Volume: Volume 2

Chapter: Chapter 2 — Database Design Principles

Section: 2.7 Standardization

Heading: 2.7 Standardization

Paragraph: Lines 199–210

Line Reference: Lines 199–210

Severity: MAJOR

Category: Multi-tenancy, normalization, data modeling

Current Text: Every transactional table shall include primary key, organization reference, branch reference, financial year, audit fields, status, version, and soft delete flag where applicable.

Problem: The standard omits tenant identifier from this early canonical pattern, even though later chapters introduce multi-tenancy.

Reason: In a shared-schema multi-tenant database, tenant scope must be foundational and consistently present in tenant-owned tables.

Enterprise Impact: Missing tenant_id in early standards can produce inconsistent schemas and cross-tenant leakage risk.

Recommendation: Add tenant identifier to the canonical transactional table pattern or explicitly state whether organization_id is the tenant key.

Improved Version: `Every tenant-owned transactional table shall include tenant_id, primary key, organization reference where distinct from tenant, branch reference where applicable, financial year, audit fields, status, version, and deletion/lifecycle markers.`

Related Sections: Volume 2 lines 1876–1972.

---

### Finding V2-008

Volume: Volume 2

Chapter: Chapter 3 — Data Ownership

Section: 3.1–3.8

Heading: Data Ownership

Paragraph: Lines 235–358

Line Reference: Lines 235–358

Severity: GOOD PRACTICE

Category: DDD, bounded contexts, module dependency, maintainability

Current Text: Each business data element has one authoritative owner responsible for creation, validation, updates, protection, and documentation; other modules consume rather than own the data.

Problem: No issue with the ownership principle.

Reason: Single ownership prevents duplicate validation, conflicting updates, and inconsistent lifecycle rules.

Enterprise Benefit: Supports bounded contexts, clean module dependencies, and future service extraction.

Recommendation: Enforce ownership with database privileges, code ownership, service contracts, and CI dependency checks.

Improved Version: Keep current text and add enforcement mechanisms.

Related Sections: Volume 1 lines 224–230 and 340–342.

---

### Finding V2-009

Volume: Volume 2

Chapter: Chapter 3 — Data Ownership

Section: 3.9 Cross-Module Relationships

Heading: 3.9 Cross-Module Relationships

Paragraph: Lines 359–375

Line Reference: Lines 359–375

Severity: MAJOR

Category: Module dependency, circular dependency detection, API design

Current Text: Cross-module relationships are allowed when business reality requires them, such as sales invoices referencing customers and inventory items.

Problem: The document permits references but does not distinguish direct foreign keys, published read models, APIs, domain events, or anti-corruption layers.

Reason: Cross-module references can preserve integrity but also create coupling and deployment barriers.

Enterprise Impact: Direct dependencies can create circular module dependencies and make future microservice extraction difficult.

Recommendation: Define allowed cross-module reference patterns and require ADRs for references crossing bounded contexts.

Improved Version: `Cross-module references shall use approved patterns: shared-kernel identifiers, published read models, application APIs, integration events, or documented foreign keys where the ownership matrix explicitly permits them.`

Related Sections: Volume 2 lines 884–903 and 1411–1419.

---

### Finding V2-010

Volume: Volume 2

Chapter: Chapter 3 — Data Ownership

Section: 3.16 Data Ownership Matrix

Heading: 3.16 Data Ownership Matrix

Paragraph: Lines 455–473

Line Reference: Lines 455–473

Severity: MAJOR

Category: Documentation quality, implementation feasibility, governance

Current Text: Every major table must be documented with table name, owning module, allowed writers, allowed readers, business purpose, and lifecycle.

Problem: The matrix format is defined, but no actual ownership matrix is provided in this document.

Reason: Without concrete ownership rows, the policy is not directly implementable.

Enterprise Impact: Teams may interpret ownership differently for shared ERP entities, creating conflicts during schema design.

Recommendation: Add a baseline ownership matrix for platform, master-data, transaction, audit, reporting, and configuration tables.

Improved Version: Add rows for users, organizations, branches, modules, subscriptions, customers, suppliers, items, invoices, payments, ledger entries, audit logs, documents, workflows, and notifications.

Related Sections: Volume 2 lines 376–444.

---

### Finding V2-011

Volume: Volume 2

Chapter: Chapter 4 — Naming Conventions

Section: 4.1–4.17

Heading: Naming Conventions

Paragraph: Lines 523–783

Line Reference: Lines 523–783

Severity: GOOD PRACTICE

Category: Naming consistency, maintainability, database standards

Current Text: The chapter defines general naming rules and conventions for tables, columns, identifiers, booleans, date/time, monetary columns, constraints, indexes, sequences, triggers, views, functions, and checklist items.

Problem: No issue with establishing a naming standard.

Reason: Consistent naming is essential for maintainability, generated tooling, schema reviews, and onboarding.

Enterprise Benefit: Reduces ambiguity and improves automation potential.

Recommendation: Add executable linting rules to validate names during migration review.

Improved Version: Keep current text and add a schema-lint tool requirement.

Related Sections: Volume 1 lines 178–180 and 360–363.

---

### Finding V2-012

Volume: Volume 2

Chapter: Chapter 4 — Naming Conventions

Section: 4.8 Date and Time Columns

Heading: 4.8 Date and Time Columns

Paragraph: Lines 670–683

Line Reference: Lines 670–683

Severity: MAJOR

Category: Timezone safety, data types, auditability

Current Text: Date and time column naming is defined.

Problem: The audit found no explicit rule in this section requiring UTC storage, `timestamptz` usage for instants, tenant/user timezone presentation handling, or distinction between business dates and timestamps.

Reason: ERP systems are highly sensitive to financial-year close, payroll dates, inventory cutoffs, scheduled jobs, and audit timestamps.

Enterprise Impact: Timezone ambiguity can corrupt reporting, legal deadlines, audit ordering, and cross-region operations.

Recommendation: Define temporal standards: business dates use `date`; instants use `timestamptz` stored in UTC; user timezone is presentation metadata; never store local timestamps without timezone semantics.

Improved Version: `Business dates shall use date; event/audit instants shall use timestamptz normalized to UTC; timezone conversion shall occur at presentation/API boundaries according to tenant and user settings.`

Related Sections: Volume 2 lines 1067–1086.

---

### Finding V2-013

Volume: Volume 2

Chapter: Chapter 5 — Schema Organization

Section: 5.3–5.8

Heading: Organizational Principles / Business Modules / Dependencies

Paragraph: Lines 802–903

Line Reference: Lines 802–903

Severity: MAJOR

Category: Schema organization, module dependency, circular dependency detection

Current Text: Schemas are organized into platform, business module, reporting, and shared/reference areas, and dependencies between modules must be controlled.

Problem: The document does not define whether each module gets a PostgreSQL schema, how privileges are applied per schema, whether cross-schema foreign keys are allowed, or how migrations are ordered across schema dependencies.

Reason: Schema organization affects security, ownership, migration sequencing, and service extraction.

Enterprise Impact: Inconsistent schema usage can cause privilege sprawl and deployment-order failures.

Recommendation: Define physical schema naming, ownership roles, grants, cross-schema reference policy, and migration dependency resolution.

Improved Version: `Each module shall own a dedicated PostgreSQL schema with explicit owner roles, read/write grants, migration ordering metadata, and documented cross-schema reference rules.`

Related Sections: Volume 2 lines 455–473 and 3659–3664.

---

### Finding V2-014

Volume: Volume 2

Chapter: Chapter 6 — Data Types

Section: 6.1–6.18

Heading: Data Types

Paragraph: Lines 946–1168

Line Reference: Lines 946–1168

Severity: GOOD PRACTICE

Category: Database standards, normalization, maintainability

Current Text: The chapter covers standard data types including character, numeric, monetary, percentage, date, boolean, UUID, JSONB, enumerations, NULL handling, defaults, matrices, and anti-patterns.

Problem: No issue with having a centralized data-type standard.

Reason: Data type consistency prevents precision loss, inconsistent validations, and migration friction.

Enterprise Benefit: Improves query predictability, reporting accuracy, and schema maintainability.

Recommendation: Add exact precision/scale defaults for money and quantity by domain and currency requirements.

Improved Version: Keep current text and add domain-specific numeric precision standards.

Related Sections: Volume 2 lines 1024–1066.

---

### Finding V2-015

Volume: Volume 2

Chapter: Chapter 6 — Data Types

Section: 6.12 JSONB

Heading: 6.12 JSONB

Paragraph: Lines 1108–1117

Line Reference: Lines 1108–1117

Severity: MAJOR

Category: JSON usage, normalization, reporting, constraints

Current Text: JSONB usage is addressed as a data type category.

Problem: The document does not sufficiently define when JSONB is allowed, how JSON schema is validated, how JSONB fields are indexed, or how JSONB avoids becoming an ungoverned substitute for normalized tables.

Reason: ERP data often requires relational integrity, reporting, filtering, and auditability.

Enterprise Impact: Overuse of JSONB can bypass constraints, reduce data quality, and complicate reporting.

Recommendation: Limit JSONB to extension metadata, integration payload snapshots, and sparse configuration where schema evolution is necessary; require JSON schema validation and documented indexes for queried keys.

Improved Version: `JSONB shall not store core transactional facts that require relational constraints; allowed usage requires owner, schema contract, validation, indexing plan, and reporting impact review.`

Related Sections: Volume 2 lines 1156–1166.

---

### Finding V2-016

Volume: Volume 2

Chapter: Chapter 7 — Primary Keys

Section: 7.1–7.14

Heading: Primary Keys

Paragraph: Lines 1171–1301

Line Reference: Lines 1171–1301

Severity: GOOD PRACTICE

Category: Primary keys, API design, migration

Current Text: The chapter standardizes primary keys, explains UUIDs, separates internal codes from primary keys, discourages composite/natural keys, and discusses API/import implications.

Problem: No issue with the overall primary-key strategy.

Reason: UUID surrogate keys are practical for distributed clients, integrations, imports, and future module/service extraction.

Enterprise Benefit: Reduces natural-key mutation risk and supports safer integration boundaries.

Recommendation: Define UUID version choice and generation location, such as application-generated UUIDv7 or database-generated UUID, and evaluate index locality.

Improved Version: Add: `The platform shall standardize UUID version and generation mechanism, considering index locality, privacy, and distributed creation needs.`

Related Sections: Volume 2 lines 1193–1229.

---

### Finding V2-017

Volume: Volume 2

Chapter: Chapter 8 — Foreign Keys

Section: 8.7 Cascade Rules

Heading: 8.7 Cascade Rules

Paragraph: Lines 1376–1401

Line Reference: Lines 1376–1401

Severity: GOOD PRACTICE

Category: Referential integrity, data protection, auditability

Current Text: Cascade behavior is treated as a controlled design decision rather than a default convenience.

Problem: No issue with the principle.

Reason: ERP deletion cascades can destroy financial or operational history if used casually.

Enterprise Benefit: Protects auditability and historical correctness.

Recommendation: Require ADR or schema-review approval for cascade deletes on business tables.

Improved Version: Keep current text and require explicit review annotation for cascade actions.

Related Sections: Volume 2 lines 1623–1735.

---

### Finding V2-018

Volume: Volume 2

Chapter: Chapter 8 — Foreign Keys

Section: 8.9 Circular Dependencies

Heading: 8.9 Circular Dependencies

Paragraph: Lines 1411–1419

Line Reference: Lines 1411–1419

Severity: GOOD PRACTICE

Category: Circular dependency detection, schema design

Current Text: Circular dependencies are explicitly addressed.

Problem: No issue with addressing circular dependencies; enforcement details are not fully specified.

Reason: Circular foreign keys complicate inserts, deletes, migrations, testing, and module extraction.

Enterprise Benefit: Prevents schema rigidity and deployment complexity.

Recommendation: Add migration-time detection for circular foreign-key graphs.

Improved Version: Add CI check that fails migrations introducing unapproved FK cycles.

Related Sections: Volume 1 lines 224–230.

---

### Finding V2-019

Volume: Volume 2

Chapter: Chapter 9 — Audit Columns

Section: 9.1–9.16

Heading: Audit Columns

Paragraph: Lines 1473–1610

Line Reference: Lines 1473–1610

Severity: MAJOR

Category: Audit, compliance, security, database design

Current Text: Mandatory audit columns, creation/update/deletion audit, user references, lifecycle columns, version columns, automation, reporting benefits, compliance, exceptions, and anti-patterns are defined.

Problem: The chapter focuses on row audit columns but does not fully define immutable audit event logs, before/after values, read-access audit, privileged access audit, tenant-scoped correlation IDs, export audit, or tamper evidence.

Reason: Row audit columns are useful metadata but are insufficient for forensic and compliance-grade ERP auditing.

Enterprise Impact: The platform may not meet regulatory or internal control requirements.

Recommendation: Add append-only audit event tables with tamper-evident retention, actor/session/request metadata, tenant scope, and event payload standards.

Improved Version: `Audit columns shall identify current row lifecycle metadata, while immutable audit-event tables shall record business and security events with before/after values, actor, tenant, correlation ID, and retention policy.`

Related Sections: Volume 1 lines 356–358; Volume 2 lines 2653–2661 and 3518–3528.

---

### Finding V2-020

Volume: Volume 2

Chapter: Chapter 10 — Soft Deletes

Section: 10.1–10.14

Heading: Soft Deletes

Paragraph: Lines 1620–1735

Line Reference: Lines 1620–1735

Severity: MAJOR

Category: Soft delete, data lifecycle, privacy, performance

Current Text: Soft deletes, visibility, restoration, restrictions, referential integrity, UX, retention, purge, benefits, and anti-patterns are covered.

Problem: Soft delete is standardized, but the document does not fully resolve conflicts with privacy erasure, legal hold, unique constraints across deleted rows, query filtering enforcement, and partition/archive interaction.

Reason: Soft deletes preserve history but can conflict with retention limits and personal-data erasure obligations.

Enterprise Impact: Data may be retained longer than legally allowed or accidentally visible through queries that forget filters.

Recommendation: Define lifecycle states: active, soft-deleted, archived, legally held, anonymized, purged; add filtered unique-index standards and default query scopes.

Improved Version: `Soft deletion shall be governed by retention, legal hold, anonymization, filtered uniqueness, tenant scoping, and mandatory query-filter enforcement standards.`

Related Sections: Volume 2 lines 2745–2751 and 3182–3296.

---

### Finding V2-021

Volume: Volume 2

Chapter: Chapter 11 — Versioning

Section: 11.1–11.16

Heading: Versioning

Paragraph: Lines 1739–1862

Line Reference: Lines 1739–1862

Severity: GOOD PRACTICE

Category: Concurrency, API design, integration reliability

Current Text: Versioning covers optimistic concurrency, version columns, update workflow, conflict detection, API requirements, bulk operations, immutable records, integrations, performance, exceptions, and future extensions.

Problem: No issue with adopting optimistic concurrency.

Reason: Version columns reduce lost updates in multi-user ERP workflows.

Enterprise Benefit: Improves data correctness under concurrent editing by clerks, managers, integrations, and background jobs.

Recommendation: Define exact API status code and error payload for version conflicts.

Improved Version: Add `409 Conflict` response format with current version and conflict details.

Related Sections: Volume 2 lines 1756–1802.

---

### Finding V2-022

Volume: Volume 2

Chapter: Chapter 12 — Multi-Tenant Architecture

Section: 12.1–12.15

Heading: Multi-Tenant Architecture

Paragraph: Lines 1871–2023

Line Reference: Lines 1871–2023

Severity: CRITICAL

Category: Multi-tenancy, security, database isolation, scalability

Current Text: The document defines tenant concepts, architecture model, tenant identifier, tenant-owned tables, shared platform tables, isolation, backend enforcement, context, benefits, challenges, security considerations, and future scalability.

Problem: The chapter supports multi-tenancy but does not mandate PostgreSQL Row Level Security, tenant-aware database roles, tenant-scoped backup/restore, tenant migration/export, per-tenant encryption strategy, or automated tests proving isolation.

Reason: Application-only tenant filtering is fragile. Every query, cache, report, background job, and export path must preserve tenant isolation.

Enterprise Impact: Cross-tenant data exposure is a critical enterprise and legal failure.

Recommendation: Require defense-in-depth tenant isolation: tenant_id constraints, composite foreign keys where needed, RLS or equivalent enforced policies, tenant-aware roles, tenant-scoped audit/logging, and automated isolation tests.

Improved Version: `Tenant isolation shall be enforced through tenant identifiers, constraints, authorization, tenant-aware database policies such as RLS where applicable, tenant-scoped operational procedures, and mandatory isolation tests.`

Related Sections: Volume 1 lines 63–67; Volume 2 lines 2095–2129.

---

### Finding V2-023

Volume: Volume 2

Chapter: Chapter 13 — Organization Isolation

Section: 13.2–13.12

Heading: Organization / Branch / Financial Year Isolation

Paragraph: Lines 2041–2166

Line Reference: Lines 2041–2166

Severity: MAJOR

Category: Multi-company, multi-branch, accounting period control, security

Current Text: The chapter defines organization, branch, financial year, mandatory references, master/transaction data, reporting, transfers, year closure, and security.

Problem: The hierarchy between tenant and organization is not fully reconciled. It is unclear whether one tenant can contain multiple organizations/companies and whether organization_id is an isolation boundary distinct from tenant_id.

Reason: ERP multi-company architecture affects chart of accounts, tax registrations, statutory reports, intercompany transactions, branches, permissions, and financial-year close.

Enterprise Impact: Incorrect hierarchy can cause accounting/reporting errors and security leakage between companies under the same tenant.

Recommendation: Define tenant/company/organization/branch/legal-entity hierarchy and permissible data sharing rules.

Improved Version: `A tenant may contain one or more legal organizations only if explicitly supported; tenant_id, organization_id, branch_id, and financial_year_id shall have defined meanings, constraints, permission scopes, and reporting boundaries.`

Related Sections: Volume 1 lines 63–66 and 84–86.

---

### Finding V2-024

Volume: Volume 2

Chapter: Chapter 14 — Shared Data

Section: 14.1–14.13

Heading: Shared Data

Paragraph: Lines 2185–2334

Line Reference: Lines 2185–2334

Severity: MAJOR

Category: Shared platform data, caching, versioning, security

Current Text: Shared data categories include system reference data, platform configuration, technical metadata, and global constants, with modification, caching, versioning, examples, and anti-patterns.

Problem: Shared data caching strategy is mentioned but does not define cache invalidation, tenant-specific overrides, environment promotion, signed configuration, or rollback rules.

Reason: Shared reference/configuration data drives behavior across modules and tenants.

Enterprise Impact: Stale or inconsistent shared data can cause pricing, tax, permission, workflow, and UI errors.

Recommendation: Add cache invalidation, versioning, migration, environment promotion, and override hierarchy rules.

Improved Version: `Shared data shall be versioned, cache-invalidated through a documented mechanism, environment-promoted through migrations, and scoped for global, tenant, organization, and branch overrides where allowed.`

Related Sections: Volume 1 lines 173–180.

---

### Finding V2-025

Volume: Volume 2

Chapter: Chapter 15 — Master Data

Section: 15.1–15.16

Heading: Master Data

Paragraph: Lines 2338–2498

Line Reference: Lines 2338–2498

Severity: GOOD PRACTICE

Category: Master data management, normalization, reporting

Current Text: Master data is defined with objectives, characteristics, categories, ownership, lifecycle, business codes, duplicate prevention, relationships, version control, security, reporting, future extensions, and anti-patterns.

Problem: No issue with the conceptual treatment.

Reason: Master data consistency is a core ERP success factor.

Enterprise Benefit: Improves transaction accuracy, reporting, integrations, and operational consistency.

Recommendation: Add survivorship, merge/split, deduplication workflow, and external reference mapping standards.

Improved Version: Keep current text and add MDM workflow standards.

Related Sections: Volume 2 lines 393–404 and 2409–2449.

---

### Finding V2-026

Volume: Volume 2

Chapter: Chapter 16 — Transaction Data

Section: 16.1–16.15

Heading: Transaction Data

Paragraph: Lines 2506–2681

Line Reference: Lines 2506–2681

Severity: GOOD PRACTICE

Category: Transaction modeling, auditability, financial accuracy

Current Text: Transaction data covers characteristics, categories, header-detail structure, mandatory references, status, immutability, document numbering, relationships, historical accuracy, auditability, reporting, and anti-patterns.

Problem: No issue with the overall transaction modeling direction.

Reason: Header-detail structures, immutable posted states, document numbering, and mandatory references are standard ERP patterns.

Enterprise Benefit: Supports reliable invoices, orders, stock movements, accounting entries, and reporting.

Recommendation: Add transaction boundary and posting atomicity standards tied to backend services and database transactions.

Improved Version: Add: `Posting operations shall be atomic across all affected transaction, inventory, ledger, audit, and outbox records.`

Related Sections: Volume 2 lines 3309–3340.

---

### Finding V2-027

Volume: Volume 2

Chapter: Chapter 17 — Index Strategy

Section: 17.1–17.15

Heading: Index Strategy

Paragraph: Lines 2685–2804

Line Reference: Lines 2685–2804

Severity: GOOD PRACTICE

Category: Performance, scalability, query optimization

Current Text: Index strategy covers PK/FK indexes, composite indexes, unique indexes, partial indexes, covering indexes, over-indexing, reporting indexes, monitoring, maintenance, and anti-patterns.

Problem: No issue with the broad coverage.

Reason: Index governance is essential for high-volume ERP transactional and reporting workloads.

Enterprise Benefit: Improves predictable query performance and prevents unmanaged index sprawl.

Recommendation: Add required EXPLAIN-plan review thresholds and production index-usage monitoring metrics.

Improved Version: Keep current text and add index review gates for high-cardinality transactional tables.

Related Sections: Volume 1 lines 115 and 233–235.

---

### Finding V2-028

Volume: Volume 2

Chapter: Chapter 18 — Constraints

Section: 18.1–18.14

Heading: Constraints

Paragraph: Lines 2811–2918

Line Reference: Lines 2811–2918

Severity: GOOD PRACTICE

Category: Constraints, integrity, validation layers

Current Text: Constraints include NOT NULL, UNIQUE, CHECK, DEFAULT, FK, exclusion constraints, ownership, validation layers, exceptions, and anti-patterns.

Problem: No issue with the constraint-first principle.

Reason: Database constraints provide non-bypassable protection for persistent business data.

Enterprise Benefit: Reduces corruption even when application bugs or integrations attempt invalid writes.

Recommendation: Require every migration to include constraint rationale or explicit exception.

Improved Version: Keep current text and add migration checklist enforcement.

Related Sections: Volume 2 lines 81–91.

---

### Finding V2-029

Volume: Volume 2

Chapter: Chapter 19 — Normalization

Section: 19.1–19.14

Heading: Normalization

Paragraph: Lines 2922–3030

Line Reference: Lines 2922–3030

Severity: GOOD PRACTICE

Category: Database normalization, data quality, maintainability

Current Text: The chapter covers 1NF, 2NF, 3NF, BCNF, controlled denormalization, lookup tables, derived data, duplication, normalization versus performance, examples, and anti-patterns.

Problem: No issue with treating normalization as a formal database standard.

Reason: ERP correctness requires normalized master and transaction data, with intentional denormalization only when justified.

Enterprise Benefit: Reduces update anomalies, duplicate facts, and reporting inconsistencies.

Recommendation: Add design-review templates requiring normalization level and denormalization justification.

Improved Version: Keep current text and add review evidence requirements.

Related Sections: Volume 2 lines 180–188.

---

### Finding V2-030

Volume: Volume 2

Chapter: Chapter 20 — Partitioning

Section: 20.1–20.13

Heading: Partitioning

Paragraph: Lines 3038–3179

Line Reference: Lines 3038–3179

Severity: MAJOR

Category: Partitioning, scalability, operations

Current Text: Partitioning is explained, candidate tables are listed, methods and strategy are discussed, partition keys and automatic partition creation are covered, and limitations/anti-patterns are listed.

Problem: The chapter does not define global uniqueness implications, foreign-key limitations, tenant-versus-time partitioning tradeoffs, backup/restore impact, archiving alignment, or operational runbooks for partition maintenance.

Reason: PostgreSQL partitioning changes query plans, constraints, indexes, retention, migrations, and operational procedures.

Enterprise Impact: Incorrect partitioning can degrade performance and complicate maintenance.

Recommendation: Add partition design ADR template, partition lifecycle automation, uniqueness strategy, and monitoring requirements.

Improved Version: `Partitioned tables shall have an approved partition key, uniqueness strategy, FK strategy, retention/archive alignment, automatic partition management, and monitoring runbook before production use.`

Related Sections: Volume 2 lines 2685–2804 and 3182–3296.

---

### Finding V2-031

Volume: Volume 2

Chapter: Chapter 21 — Archiving

Section: 21.1–21.14

Heading: Archiving

Paragraph: Lines 3182–3296

Line Reference: Lines 3182–3296

Severity: MAJOR

Category: Archival, retention, legal hold, performance

Current Text: Archiving covers candidate data, criteria, methods, accessibility, integrity, automation, restoration, legal hold, performance benefits, anti-patterns, and summary.

Problem: The chapter does not define retention schedules by data class, archive storage technology, encryption/key retention, searchable archive indexes, purge approval, or tenant-level export/delete requirements.

Reason: Archiving is not only performance optimization; it is also legal, compliance, and operational lifecycle management.

Enterprise Impact: Data may be retained too long, deleted too early, or become inaccessible during audits.

Recommendation: Add data-class retention matrix and archive architecture.

Improved Version: `Archiving shall follow a data-class retention matrix with legal-hold, encryption, searchability, restoration SLA, purge approval, and tenant-level portability requirements.`

Related Sections: Volume 2 lines 1701–1719 and 3372–3387.

---

### Finding V2-032

Volume: Volume 2

Chapter: Chapter 22 — Backup Strategy

Section: 22.1–22.13

Heading: Backup Strategy

Paragraph: Lines 3304–3429

Line Reference: Lines 3304–3429

Severity: MAJOR

Category: Backup, restore, PITR, disaster recovery, security

Current Text: Backup strategy covers definitions, backup types, frequency, storage, encryption, verification, DR environment, recovery procedures, security, and anti-patterns.

Problem: The chapter does not provide concrete RPO/RTO values, PITR window, restore-test frequency, tenant-level restore approach, backup immutability, cross-region strategy, or ownership/runbook details.

Reason: Enterprise backup architecture is only useful if measurable and periodically verified.

Enterprise Impact: Recovery may fail during ransomware, accidental deletion, corruption, or regional outage.

Recommendation: Define RPO/RTO tiers, PITR retention, immutable backup storage, restore drills, tenant restore policy, and runbook ownership.

Improved Version: `Production databases shall define RPO, RTO, PITR retention, immutable offsite backups, restore-drill cadence, tenant-level recovery policy, and documented recovery runbooks.`

Related Sections: Volume 1 lines 112–125.

---

### Finding V2-033

Volume: Volume 2

Chapter: Chapter 23 — Database Security

Section: 23.1–23.16

Heading: Database Security

Paragraph: Lines 3433–3566

Line Reference: Lines 3433–3566

Severity: MAJOR

Category: Database security, monitoring, compliance

Current Text: Database security covers defense in depth, authentication, authorization, least privilege, connection security, sensitive data, password storage, SQL injection protection, audit logging, monitoring, administrative access, compliance, and anti-patterns.

Problem: The chapter is directionally correct but omits secrets rotation, break-glass procedures, privileged access management tooling, database activity monitoring, RLS enforcement, masking in non-production, SAST/SCA for SQL injection prevention, and incident response hooks.

Reason: ERP databases are high-value targets and need operational security controls in addition to design principles.

Enterprise Impact: Weak operational security can expose sensitive financial, HR, payroll, and customer data.

Recommendation: Add operational security control requirements and evidence collection procedures.

Improved Version: `Database security shall include managed secrets rotation, PAM/break-glass access, RLS where applicable, non-production masking, database activity monitoring, vulnerability management, and incident-response evidence retention.`

Related Sections: Volume 1 lines 352–354; Volume 2 lines 121–130.

---

### Finding V2-034

Volume: Volume 2

Chapter: Chapter 24 — Migration Strategy

Section: 24.1–24.15

Heading: Migration Strategy

Paragraph: Lines 3574–3694

Line Reference: Lines 3574–3694

Severity: MAJOR

Category: Migration strategy, rollback, CI/CD, implementation feasibility

Current Text: Migration strategy covers definition, principles, version control, execution order, forward-only strategy, rollback, data migrations, module migrations, environment consistency, validation, emergency fixes, and anti-patterns.

Problem: The document does not specify the concrete migration tool, transactional migration policy, zero-downtime expand/contract pattern, backward-compatible deployment rules, migration locking, dry-run process, or production approval gates.

Reason: ERP schema migrations must be safe under large data volumes and multi-tenant operations.

Enterprise Impact: Bad migrations can cause downtime, data corruption, or failed releases.

Recommendation: Define migration tooling and release process in DevOps alignment.

Improved Version: `Database migrations shall use the approved migration tool, run through CI dry-runs, follow expand/contract for zero-downtime changes, include rollback/roll-forward plans, and require production approval gates.`

Related Sections: Volume 1 lines 310–314; Volume 5 pending.

---

### Finding V2-035

Volume: Volume 2

Chapter: Chapter 26 — Database Governance

Section: 26.1–26.14

Heading: Database Governance

Paragraph: Lines 3701–3864

Line Reference: Lines 3701–3864

Severity: MAJOR

Category: Governance, roles and responsibilities, documentation quality

Current Text: Governance covers principles, roles, change approval, documentation, ADRs, performance, security, data quality, compliance, continuous improvement, anti-patterns, and summary.

Problem: Governance is useful but appears as Chapter 26 after Chapter 24, while Chapter 25 is absent. The roles/responsibilities must also be connected to actual approval workflows and CI gates.

Reason: Governance without enforceable workflow and artifact requirements becomes advisory only.

Enterprise Impact: Database standards may be bypassed during delivery pressure.

Recommendation: Fix numbering and add governance gates: schema review, security review, performance review, migration review, data-quality review, and release approval.

Improved Version: `Every database change shall pass automated checks and required human reviews based on risk: schema integrity, tenancy, security, performance, migration safety, and data governance.`

Related Sections: Volume 1 lines 374–376.

---

### Finding V2-036

Volume: Volume 2

Chapter: Chapter 27 — Conclusion

Section: 27.1–27.8

Heading: Architectural Decisions Established / Roadmap / Final Statement

Paragraph: Lines 3868–3944

Line Reference: Lines 3868–3944

Severity: MINOR

Category: Documentation quality, traceability, roadmap

Current Text: The conclusion summarizes decisions, design principles, relationships to other volumes, implementation roadmap, long-term vision, and final statement.

Problem: The conclusion does not enumerate unresolved database ADRs, measurable readiness gates, or owner/date for roadmap milestones.

Reason: A conclusion in an enterprise architecture standard should clearly separate approved standards from pending decisions.

Enterprise Impact: Teams may assume unresolved areas such as RLS, tenant restore, migration tooling, and RPO/RTO are already decided.

Recommendation: Add `Open Database ADRs`, `Readiness Gates`, and `Pending Cross-Volume Dependencies` sections.

Improved Version: Add open decisions for tenant isolation mechanism, UUID version, migration tool, RPO/RTO, archive storage, masking, and schema linting.

Related Sections: Volume 2 lines 1871–2023, 3304–3429, and 3574–3694.

---

### Finding V2-037

Volume: Volume 2

Chapter: Appendices

Section: Appendix A

Heading: Database Checklist

Paragraph: Lines 3950–4092

Line Reference: Lines 3950–4092

Severity: GOOD PRACTICE

Category: Documentation quality, implementation governance, maintainability

Current Text: Appendix A provides a database checklist.

Problem: No issue with including a checklist, but checklist enforceability is not specified.

Reason: Checklists improve review consistency only when tied to delivery gates.

Enterprise Benefit: Provides a practical review mechanism for database design and migration readiness.

Recommendation: Convert the appendix into a mandatory PR/migration review checklist with pass/fail evidence fields.

Improved Version: Add columns: `Required`, `Evidence`, `Reviewer`, `Status`, and `Exception ADR`.

Related Sections: Volume 2 lines 3701–3864.

---

## Cross-Volume Validation Notes After Volume 2

1. Volume 1 identified multi-tenancy as under-specified. Volume 2 expands multi-tenancy but still does not fully mandate defense-in-depth isolation such as RLS or automated tenant isolation tests. Status: unresolved critical risk.
2. Volume 1 states ADRs can supersede the SAD, while governance hierarchy needed clarification. Volume 2 also uses ADRs for deviations. Status: governance model still needs consistent precedence wording across volumes.
3. Volume 1 requires backend business logic and database source-of-truth behavior. Volume 2 is consistent with this, but must avoid over-coupling modules through direct database references.
4. Volume 1 did not define measurable NFRs. Volume 2 repeats qualitative performance language in scalability, backup, and recovery sections. Status: measurable SLO/RPO/RTO targets remain missing.
5. Volume 1 listed platform services but not operational tooling. Volume 2 adds database lifecycle concepts but still lacks concrete CI/CD enforcement, migration tooling, and operational runbooks.

## Enterprise Checklist Status for Volume 2 Only

- Constraints: Found and generally strong.
- Foreign Keys: Found and generally strong.
- Check Constraints: Found.
- Indexes / Composite Indexes / Partial Indexes / Covering Indexes: Found.
- Partitioning: Found but needs operational detail.
- Materialized Views: Not found in this document.
- Read Replicas: Not found in this document.
- Backup / Restore / PITR: Backup and restore found; concrete RPO/RTO/PITR details are incomplete.
- Encryption: Found, but under-specified.
- Row Level Security: Not found as a mandatory control in this document.
- JSON usage: Found, but governance needs strengthening.
- Migration strategy: Found, but tooling and zero-downtime process are incomplete.
- Archive strategy: Found, but retention matrix and archive architecture are incomplete.
- Soft delete: Found, but privacy/retention/filtered uniqueness details need strengthening.
- History tables / immutable audit events: Partially found; row audit columns found, full immutable event history under-specified.
- Multi-tenant: Found, but critical defense-in-depth details remain incomplete.
- Normalization: Found and directionally good.
- Data ownership: Found and directionally good.
- Security monitoring / privileged access / masking: Partially found, but operational details incomplete.

# Database Architectural Domain

## Purpose
This domain defines the authoritative database architecture for the Enterprise ERP Platform. It governs PostgreSQL standards, multi-tenancy implementation, and data governance required for scalable, secure enterprise operations.

## Architecture Documentation

### Part I: Philosophy & Ownership
1. [Vision & Design Principles](./01-vision-principles.md) - Core tenets and measurable scalability SLOs.
2. [Data Ownership Model](./02-data-ownership.md) - Responsibility matrix and Bounded Context rules.

### Part II: Technical Standards
3. [Naming Conventions](./03-naming-conventions.md) - Standardized identifiers, booleans, and UTC/Timestamptz rules.
4. [Schema Organization](./04-schema-organization.md) - Physical module isolation using PostgreSQL schemas.
5. [Data Types & Columns](./05-data-types.md) - Numeric precision and JSONB governance policies.
6. [Primary Key Strategy](./06-primary-keys.md) - UUIDv7 standard for identifiers.
7. [Referential Integrity](./07-referential-integrity.md) - Foreign Key standards and circular dependency prevention.

### Part III: Lifecycle & Visibility
8. [Audit & Record Lifecycle](./08-audit-lifecycle.md) - Row-level audit columns and append-only event logs.
9. [Soft Delete & Retention](./09-soft-delete-retention.md) - Logical deletion versus Privacy/Purge/GDPR requirements.
10. [Concurrency Control](./10-concurrency-control.md) - Optimistic locking and API conflict resolution.

### Part IV: Multi-Tenancy & Isolation
11. [Multi-Tenant Architecture](./11-multi-tenancy.md) - Shared schema implementation with PostgreSQL RLS.
12. [Organizational Isolation](./12-organizational-isolation.md) - Multi-company, Branch, and Financial Year hierarchy.
13. [Shared, Master & Transaction Data](./13-data-categories.md) - Categorization and caching strategies.

### Part V: Optimization & Reliability
14. [Performance Optimization](./14-performance-optimization.md) - Indexing strategy, constraints, and normalization levels.
15. [Scalability & Archival](./15-scalability-archival.md) - Table partitioning and historical data management.
16. [Security Architecture](./16-security-architecture.md) - Encryption-at-rest, TLS, and Operational security controls.
17. [Backup & Disaster Recovery](./17-backup-recovery.md) - RPO/RTO targets and recovery runbooks.

### Part VI: Governance
18. [Lifecycle & Governance](./18-lifecycle-governance.md) - Migration strategy and Change Approval Process (CAP).
19. [Trigger Governance](./19-trigger-governance.md) - Trigger lifecycle, testing, migration, and ownership requirements.
20. [Migration Recovery Procedure](./20-migration-recovery-procedure.md) - Required rollback/recovery planning and verification for versioned migrations.

## Appendices
- [Standard SQL Templates](./appendix-templates.md)

## Key Principles

1. **Database First**: Data model design precedes application development.
2. **Integrity by Constraint**: Critical business rules enforced by database constraints.
3. **Multi-Tenant**: Row-Level Security (RLS) enforces isolation.
4. **System of Record**: PostgreSQL is the authoritative persistence layer and single source of truth for ERP data.
5. **ORM**: Drizzle ORM is the current type-safe database access technology.

## Related Documentation
- [System Architecture](../02-architecture/02-system-architecture.md)
- [ADR Index](../10-adr/README.md)

# Database Architecture

This directory contains database strategy, design standards, and persistence layer architecture.

## Documents Contained

This section is reserved for Volume 2 detailed content (Database Architecture & Standards).

## From Volume 1

### Database Strategy

**Database Platform**: PostgreSQL

PostgreSQL is the official database platform due to:
- ACID compliance for data integrity
- Advanced indexing for performance
- Strong transaction support for consistency
- Mature ecosystem and tooling
- JSON capabilities for flexible data
- Partitioning support for large tables
- Enterprise reliability and support

**System of Record**: PostgreSQL is the single source of truth for all business data. No secondary database shall become the system of record without formal architectural approval.

**ORM**: Database interaction shall be implemented using Drizzle ORM due to:
- Excellent TypeScript integration
- Type-safe SQL
- Explicit schema definition
- Migration support
- High performance

**Direct SQL**: Direct SQL remains permissible where necessary for performance-critical operations.

### Key Principles

1. **Database First**: Data model design precedes application development
2. **Integrity by Constraint**: Critical business rules enforced by database constraints
3. **ACID Transactions**: All transactional changes maintain ACID properties
4. **Multi-Tenant**: Every table includes tenant_id; Row-Level Security enforces isolation
5. **Scalability**: Design supports growth without architectural rework

### Design Considerations

From Design Philosophy:
- Data integrity through referential integrity constraints
- Optimization for reporting requirements
- Performance through indexing and query optimization
- Long-term scalability with partitioning

### Architectural Guidance

- Business decisions should not be implemented through database triggers alone unless explicitly documented
- Application services remain responsible for business policies
- Triggers may enforce data integrity
- Business workflow triggers should be rare and documented via ADR

---

## Related Documentation

- [System Architecture](../02-architecture/02-system-architecture.md) — Data Layer description
- [Technology Stack](../05-frontend/README.md) — Database technology selection
- [Design Philosophy](../02-architecture/01-design-philosophy.md) — Database First approach
- [Volume 2 — Database Architecture & Standards](../../Enterprise%20ERP%20Software%20Architecture%20-Volume%202-Database%20Architecture%20%26%20Standards.md) — Detailed database standards

## Navigation

This volume (Volume 1) provides architectural principles for database design. See **Volume 2** for:
- Detailed database schema standards
- Table design patterns
- Migration strategies
- Indexing guidelines
- Partitioning strategies
- Backup and recovery procedures
- Query optimization
- Performance tuning

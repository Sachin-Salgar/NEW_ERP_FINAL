# ADR-0023: Table Partitioning Strategy

**Date**: 2026-09-04  
**Status**: Approved  
**Approval Date**: 2026-09-04  
**Approved By**: Project Owner following architecture review  
**Scope**: Partitioning of high-volume PostgreSQL tables

## Context

ERP transaction and audit tables may eventually become large enough that indexing, vacuuming, retention, and time-bounded queries require partitioning. Partitioning too early would add migration and RLS complexity without proven benefit.

## Decision

Use selective, evidence-driven partitioning rather than a blanket partitioning policy.

1. A table is partitioned only after workload measurements demonstrate a material operational or query-performance benefit.
2. Time-oriented, append-heavy tables are the primary candidates, using range partitioning on an appropriate timestamp column.
3. Partition keys must preserve tenant isolation and must not introduce an alternate authorization mechanism. PostgreSQL RLS remains authoritative.
4. Partitioning must preserve stable primary/unique-key semantics and application repository contracts.
5. Partition creation, maintenance, and retirement are automated as controlled database operations rather than application request logic.
6. Retention can remove or archive whole partitions only where the business retention policy permits it.
7. Every partitioning change follows the zero-downtime migration strategy where applicable and includes rollback/recovery planning.
8. Existing tables are not repartitioned merely to satisfy this ADR; each candidate receives a separate implementation assessment.

## Rationale

Selective partitioning captures the operational benefits for genuinely large tables while avoiding unnecessary complexity for ordinary ERP tables.

## Alternatives Considered

- **Partition every tenant table** — rejected because table count, migration complexity, and RLS interactions would grow without evidence of benefit.
- **Never partition** — rejected because high-volume audit/event/transaction tables can eventually exceed the practical limits of a single table.
- **Tenant-based partitioning as the default** — rejected because tenant cardinality and lifecycle vary and the partition key should follow measured access/retention patterns.

## Consequences

- Partitioning becomes a governed optimization rather than an architectural prerequisite.
- High-volume tables can gain improved maintenance and retention characteristics.
- Each partitioned table requires additional operational automation and testing.

## Implementation Notes

Candidate tables should be selected using ADR-0022 query/performance evidence and actual row-growth measurements. Validate RLS behavior against the parent and partitions with real PostgreSQL integration tests before production rollout.

## Related Documents

- ADR-0007 Zero-Downtime Migration Strategy
- ADR-0022 Query Performance Monitoring
- `docs/03-database/11-multi-tenancy.md`

# ADR-0022: Query Performance Monitoring

**Date**: 2026-09-04  
**Status**: Approved  
**Approval Date**: 2026-09-04  
**Approved By**: Project Owner following architecture review  
**Scope**: PostgreSQL query performance measurement, diagnosis, and application-level database timing

## Context

The ERP is multi-tenant and database-centric. Performance regressions must be detected without weakening RLS, leaking tenant data, or requiring every query to be manually instrumented.

## Decision

Establish layered query-performance monitoring using PostgreSQL-native statistics plus application request/database timing.

1. Enable PostgreSQL `pg_stat_statements` where supported by the deployment baseline.
2. Capture aggregate query statistics rather than raw sensitive parameter values.
3. Establish configurable slow-query thresholds for operational diagnostics; thresholds are observability settings, not correctness rules.
4. Correlate database timing with application correlation IDs and endpoint/module context where available.
5. Monitor query count, total/mean execution time, rows, and resource indicators sufficient to identify regressions.
6. Performance instrumentation must not bypass tenant context or execute diagnostic queries with broader privileges than required.
7. Use metrics and aggregated query fingerprints as the primary production signal; detailed query plans are collected during controlled diagnosis rather than indiscriminately on every request.
8. Pagination and bounded SQL retrieval should be optimized based on measured evidence, preserving the public pagination contract and RLS behavior.

## Rationale

A layered approach separates low-overhead continuous measurement from deeper diagnostic analysis. PostgreSQL already provides strong aggregate query statistics, while application timing supplies business/API context.

## Alternatives Considered

- **Application logs only** — rejected because they miss database-wide query aggregation.
- **Run `EXPLAIN ANALYZE` on every query** — rejected due to unacceptable overhead and operational risk.
- **External APM as the only source** — rejected because database-native statistics remain necessary for diagnosis and on-premises portability.

## Consequences

- Adds monitoring configuration and operational dashboards/alerts.
- Requires care around sensitive SQL and diagnostic privileges.
- Provides evidence for later indexing, pagination, partitioning, and query-shape changes.

## Implementation Notes

Define retention and alert thresholds with production workload measurements. Avoid logging literal user inputs. Performance work must not trade away RLS or authorization guarantees.

## Related Documents

- `docs/03-database/11-multi-tenancy.md`
- `docs/04-backend/21-pagination-implementation.md`
- ADR-0023 Table Partitioning Strategy

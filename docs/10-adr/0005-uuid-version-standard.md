# ADR-0005: UUID Version Standard

**Date**: 2026-08-07
**Status**: Approved
**Approval Date**: 2026-08-07
**Approved By**: Architecture Review Board

## Context

The ERP requires a globally unique identifier (UUID) for all primary business entities to support distributed systems, offline synchronization, and secure external APIs. However, standard UUID v4 (random) can lead to poor database index performance (B-Tree fragmentation) due to lack of sortability.

## Decision

We will standardize on **UUID v7** for all primary keys.

## Rationale

- **Sortability**: UUID v7 includes a 48-bit timestamp, making it time-ordered. This ensures better locality in B-Tree indexes and reduces fragmentation.
- **Global Uniqueness**: Maintains the 128-bit collision resistance required for enterprise data.
- **Compatibility**: Remains compatible with existing UUID data types in PostgreSQL and most libraries.

## Alternatives Considered

1. **UUID v4**: High risk of index bloat and performance degradation over time as table size increases.
2. **BigInt (Auto-increment)**: Exposes business volume, hard to synchronize across distributed systems, and leaks information via URLs.

## Consequences

### Positive
- Improved database write performance for large tables.
- Efficient index page utilization.
- Natural time-ordering for records created via UUID.

### Negative
- Slightly more complex generation logic compared to v4 (requires timestamp).

## Implementation Notes

- Backend services shall use a library that supports UUID v7 generation.
- Database default values for `id` columns should be set to generate UUID v7 where possible or supplied by the application.

## Related Documents

- [Volume 2: Database Architecture](../03-database/README.md)
- [Primary Key Strategy](../03-database/06-primary-keys.md)

## References

- IETF UUID v7 Specification
- PostgreSQL UUID Data Type Documentation

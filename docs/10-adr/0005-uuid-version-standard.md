# ADR-0005: UUID Version Standard

**Date**: 2026-08-07  
**Status**: Approved  
**Approval Date**: 2026-08-07  
**Approved By**: Architecture Review Board  
**Scope**: Primary identifier generation for persistent ERP entities

## Context

The ERP requires globally unique identifiers for persistent business entities to support tenant isolation, APIs, synchronization, imports, and future distributed capabilities. UUID v4 is valid but does not provide time ordering, which can reduce locality for B-tree indexes as tables grow.

## Decision

The platform will standardize on **UUID v7** for newly generated primary identifiers where UUIDs are used.

This decision does not require retrofitting existing identifiers solely to change UUID versions. Existing data migrations must follow the applicable migration ADR and preserve referential integrity.

## Rationale

- **Time ordering**: UUID v7 embeds a timestamp component and is suitable for time-ordered insertion patterns.
- **Global uniqueness**: Retains the 128-bit UUID representation.
- **PostgreSQL compatibility**: PostgreSQL supports UUID as a native data type.
- **API suitability**: UUIDs do not expose a simple sequential business-record count.

## Alternatives Considered

1. **UUID v4** — valid and widely supported, but lacks UUID v7's time-ordering characteristics.
2. **BIGINT / auto-increment** — compact and efficient, but requires centralized/sequenced allocation and exposes sequential identifiers.

## Consequences

### Positive

- Better locality for many append-oriented B-tree workloads than randomly generated UUID v4 values.
- Consistent identifier-generation standard across the platform.
- Suitable for API and synchronization boundaries.

### Negative

- UUID v7 generation must be supported consistently by the selected application/runtime libraries.
- Time ordering is not a substitute for a business timestamp; UUID ordering must not be used as the authoritative business-event time.
- Existing UUIDs are not automatically converted to v7.

## Implementation Notes

- Backend code shall use an approved UUID v7 implementation.
- Database defaults may generate UUID v7 where the selected PostgreSQL version and approved implementation support it; otherwise the application may supply the identifier.
- Identifier generation must not be implemented independently by individual business modules with incompatible conventions.
- Primary-key choice does not replace tenant isolation, authorization, audit, or business-key constraints.

## Related Documents

- [Database Architecture](../03-database/README.md)
- [Primary Key Strategy](../03-database/06-primary-keys.md)

## References

- IETF UUID specification
- PostgreSQL UUID data type documentation

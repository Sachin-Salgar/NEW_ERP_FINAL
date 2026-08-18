# ADR-0007: Zero-Downtime Migration Strategy

**Date**: 2026-08-07  
**Status**: Approved  
**Approval Date**: 2026-08-07  
**Approved By**: Architecture Review Board  
**Scope**: Production database schema and data migrations that must preserve application availability

## Context

The ERP is intended to operate continuously for multiple organizations. Database changes must therefore be introduced without requiring a routine stop-the-world maintenance window.

Not every schema change can be made literally without any blocking or operational impact, so the migration strategy must distinguish **application availability** from a guarantee of zero lock time.

## Decision

We will use the **Expand/Contract (Parallel Change) pattern** as the default strategy for production database migrations where backward compatibility is required.

Exceptions require explicit review when a change cannot safely follow the pattern, for example destructive changes that require extended data transformation or database capabilities with unavoidable blocking behavior.

## Rationale

- Keeps old and new application versions compatible during controlled deployment transitions.
- Provides a safe period for data backfill and verification.
- Reduces the need for planned application downtime.
- Supports gradual removal of obsolete schema elements after usage has ceased.

## Alternatives Considered

1. **Maintenance windows** — acceptable only for explicitly approved exceptional changes, not the default strategy.
2. **Direct breaking schema changes** — higher risk because the currently running application may still depend on the old structure.

## Consequences

### Positive

- Deployments can normally preserve application availability.
- Application rollback is safer while old schema compatibility remains.
- Large data migrations can be separated from the schema deployment step.

### Negative

- More migration steps and temporary compatibility code.
- Developers may need to support old and new representations simultaneously.
- Some operations still require careful lock, indexing, backfill, and capacity planning.

## Implementation Pattern

1. **Expand** — add the new table, column, index, or compatible constraint without removing the old structure.
2. **Migrate** — backfill or synchronize data using an approved mechanism. Triggers are one option, not a mandatory implementation.
3. **Transition** — deploy application code that can safely read/write the new representation and complete any required dual-write period.
4. **Verify** — validate data consistency, application behavior, performance, and rollback readiness.
5. **Contract** — remove the obsolete structure only after no supported application version or process requires it.

## Operational Requirements

- Migration scripts must be idempotent or otherwise safely repeatable where practical.
- Large backfills must be designed to avoid unacceptable locks, transaction growth, or resource exhaustion.
- Destructive changes require evidence that dependent code and data have been retired.
- Rollback strategy must be defined before production execution.
- Schema changes must be tested against the supported application compatibility window.
- A migration is not considered zero-downtime merely because the application process remains running; blocking locks or resource exhaustion must also be considered.

## Related Documents

- [Database Lifecycle & Governance](../03-database/18-lifecycle-governance.md)
- [Database Migration Strategy](../03-database/18-lifecycle-governance.md#241-introduction)
- [CI/CD Pipeline](../07-devops/05-ci-cd-pipeline.md)

## References

- Parallel Change / Expand-Contract database migration pattern

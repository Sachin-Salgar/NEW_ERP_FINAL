# ADR-0007: Zero-Downtime Migration Strategy

**Date**: 2026-08-07
**Status**: Approved
**Approval Date**: 2026-08-07
**Approved By**: Architecture Review Board

## Context

As an Enterprise ERP platform serving many organizations, downtime during database migrations is unacceptable. Traditional "stop-the-world" migrations lead to service interruptions that disrupt business operations.

## Decision

We will adopt the **Expand/Contract (Parallel Change) Pattern** for all database migrations.

## Rationale

- **High Availability**: Allows the application to continue running while the schema evolves.
- **Rollback Safety**: Migrations are split into backward-compatible steps, making it safer to roll back the application code without breaking the database.
- **Large Data Volumes**: Avoids long-running table locks on massive transactional tables.

## Alternatives Considered

1. **Maintenance Windows**: Not feasible for a global ERP with 24/7 operations across time zones.
2. **Direct Schema Changes**: High risk of breaking current application version during migration.

## Consequences

### Positive
- 100% uptime during deployments.
- Safer deployment pipeline.
- Ability to test new schema with old code.

### Negative
- Migrations take more steps (e.g., adding a renamed column takes 3-4 releases).
- Increased developer effort to maintain dual-version support during the transition.

## Implementation Notes

1. **Expand**: Add new table/column/constraint without removing old ones.
2. **Migrate**: Copy/Synchronize data from old to new (using triggers or background jobs).
3. **Transition**: Update application code to read/write to the new structure.
4. **Contract**: Remove the old structure after the previous step is confirmed stable in production.

## Related Documents

- [Database Lifecycle & Governance](../03-database/18-lifecycle-governance.md)
- [Database Migration Strategy](../03-database/18-lifecycle-governance.md#241-introduction)

## References

- Parallel Change Pattern (Refactoring Databases)

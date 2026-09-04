# Database Migration Recovery Procedure

**Document Purpose:** Define the required rollback/recovery planning and verification steps for versioned ERP database migrations.

This procedure operationalizes [ADR-0007: Zero-Downtime Migration Strategy](../10-adr/0007-zero-downtime-migrations.md) and the database lifecycle/governance requirements. It does not require every migration to have a mechanical `down` script. For production changes, recovery must preserve data integrity and the supported application compatibility window.

## 1. Principles

1. Production migrations use **Expand/Contract** where backward compatibility is required.
2. Every migration must have a documented recovery plan before production execution.
3. A destructive rollback must never be generated automatically when it could discard business data.
4. Application rollback and database rollback are separate decisions. During the expand/transition phase, prefer application rollback while the old schema remains compatible.
5. Contract/removal changes occur only after dependent application versions, jobs, integrations, and data have been verified as retired.
6. RLS policies, tenant boundaries, constraints, and ownership rules must remain effective throughout migration and recovery.

## 2. Required migration review record

For every new migration, the change review or accompanying implementation note must record:

| Field | Required content |
|---|---|
| Migration ID | Repository migration file/name. |
| Change classification | Expand, data migration/backfill, transition, contract, or emergency hotfix. |
| Compatibility window | Application versions/processes that must remain compatible. |
| Data impact | Tables/columns/indexes/policies/data affected, including tenant-scoped data. |
| Lock/performance risk | Expected locks, scan/backfill size, index-build implications, and mitigations. |
| Forward verification | Queries/tests proving the migration produced the expected state. |
| Recovery trigger | Observable condition that requires rollback/recovery. |
| Recovery action | Application rollback, compensating forward migration, restore, or reviewed `down` SQL. |
| Data preservation | How writes made after migration are preserved during recovery. |
| Security verification | RLS/permissions/constraints checks after migration and after recovery. |
| Backup/restore dependency | Whether recovery depends on backup/PITR and evidence that the required restore path is available. |

## 3. Recovery strategy selection

### 3.1 Expand migration

Examples: adding a nullable column, compatible table, optional index, or compatible constraint.

Preferred recovery:
- Roll the application back while leaving the compatible expanded schema in place when safe.
- Remove the expanded object later through a reviewed contract migration if it is no longer required.
- A `down` statement may be provided only when removal is demonstrably non-destructive and no deployed code or data depends on the object.

### 3.2 Data migration or backfill

Preferred recovery:
- Stop or disable the affected transition path if required.
- Use a verified compensating migration when the transformation is reversible without data loss.
- If the transformation is not safely reversible, use the approved backup/PITR recovery plan rather than destructive inverse SQL.
- Record reconciliation queries before and after recovery.

### 3.3 Transition migration/application release

Preferred recovery:
- Roll application code back to a version compatible with both old and expanded representations.
- Preserve synchronized/dual-written data until recovery is complete.
- Do not contract the old representation while rollback remains a supported operational action.

### 3.4 Contract/destructive migration

Contract migrations require explicit evidence that obsolete structures and consumers have been retired.

Recovery must be planned before execution and normally uses one of:
- a compensating forward migration,
- restore/PITR to a validated recovery point,
- a specifically reviewed inverse script where data preservation is proven.

A generic `DROP` reversal is not an acceptable recovery plan for deleted business data.

## 4. Pre-production verification

Before a production migration is approved:

1. Apply the migration to a production-like PostgreSQL environment using the same migration runner used by the application.
2. Run migration verification checks and the relevant backend integration/security tests.
3. Verify tenant isolation and RLS behavior for every changed tenant-owned table or policy.
4. Exercise the documented application rollback or database recovery action in a non-production environment when practicable.
5. Re-run the relevant tests after recovery.
6. Re-apply the forward migration if the supported recovery path is intended to be repeatable.
7. Record any operation that cannot be safely exercised automatically and the manual approval/runbook required instead.

## 5. CI expectations

CI must prove the forward migration path against PostgreSQL. Where a migration supplies a safe, non-destructive automated recovery test, CI should execute that recovery and re-apply the migration.

CI must **not** execute destructive rollback SQL merely to satisfy a generic pipeline step. Contract migrations, large backfills, restore/PITR procedures, and other environment-dependent recovery actions require their documented staging/runbook validation.

The repository integration suite remains the executable baseline for migration correctness, tenant isolation, RLS, and transaction rollback behavior.

## 6. Production execution checklist

- [ ] Migration reviewed and version controlled.
- [ ] ADR/CAP approval obtained where required.
- [ ] Expand/Contract stage identified.
- [ ] Compatibility window confirmed.
- [ ] Backup/PITR readiness confirmed when recovery depends on it.
- [ ] Forward verification queries/tests prepared.
- [ ] Recovery trigger and owner identified.
- [ ] Recovery action rehearsed where practicable.
- [ ] Lock/performance risk reviewed.
- [ ] RLS/security verification prepared.
- [ ] Application rollback compatibility confirmed.
- [ ] Post-migration health/authentication checks prepared.

## 7. Post-migration verification

After migration:

1. Confirm migration runner state and expected schema objects.
2. Run relevant health/readiness checks.
3. Validate authentication and representative tenant-scoped operations where applicable.
4. Verify RLS/security behavior on changed persistence surfaces.
5. Review database/application errors and performance indicators.
6. Complete data reconciliation for backfills/transforms.
7. Retain the previous compatible application artifact until the rollback window closes.
8. Schedule contract cleanup only after the transition criteria are satisfied.

## Related Documentation

- [ADR-0007: Zero-Downtime Migration Strategy](../10-adr/0007-zero-downtime-migrations.md)
- [Lifecycle & Governance](./18-lifecycle-governance.md)
- [Backup & Disaster Recovery](./17-backup-recovery.md)
- [CI/CD Pipeline](../07-devops/05-ci-cd-pipeline.md)

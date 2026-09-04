# ADR-0019: Scheduler Service

**Date**: 2026-09-04  
**Status**: Approved  
**Approval Date**: 2026-09-04  
**Approved By**: Project Owner following architecture review  
**Scope**: Durable scheduled and recurring background work

## Context

ERP processes such as notifications, archival, recurring reports, maintenance, and future business jobs require reliable scheduled execution. The scheduler must survive application restarts and support multiple application instances without duplicate execution.

## Decision

Introduce a durable database-backed Scheduler Service with worker execution.

1. Store schedule definitions and job state in PostgreSQL.
2. Support one-time and recurring schedules using an explicit timezone-aware schedule model.
3. Workers claim due jobs using transactional locking/lease semantics so multiple instances can operate safely.
4. Job handlers are identified by stable application job types; arbitrary executable code is never stored in schedule data.
5. Jobs must be idempotent or carry a stable execution key to prevent harmful duplicate effects.
6. Failed jobs use bounded retries and observable failure state; permanently failed jobs require operational remediation rather than infinite retry.
7. Tenant context is explicit for tenant-owned jobs and is restored before executing tenant data access.
8. Scheduler execution is separated from HTTP request lifecycles.

## Rationale

A database-backed scheduler fits the existing PostgreSQL-centric architecture, works in single-node and multi-instance deployments, and avoids an early dependency on an external scheduling platform.

## Alternatives Considered

- **OS cron/system scheduler** — rejected as the application-authoritative scheduler because it is difficult to coordinate across instances and persist ERP job state.
- **External managed scheduler** — deferred until scale or deployment requirements justify it.
- **In-memory timers** — rejected because they do not survive restart and are unsafe in multi-instance deployments.

## Consequences

- Adds worker lifecycle and job-state management.
- Requires careful locking, idempotency, and monitoring.
- Keeps deployment portable across cloud and on-premises environments.

## Implementation Notes

Use PostgreSQL row locking or an equivalent lease model. Keep scheduler metadata separate from business transaction tables. The first implementation should favor correctness and observability over high scheduling throughput.

## Related Documents

- `docs/03-database/18-lifecycle-governance.md`
- ADR-0020 Event-Driven Architecture

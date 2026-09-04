# ADR-0020: Event-Driven Architecture

**Date**: 2026-09-04  
**Status**: Approved  
**Approval Date**: 2026-09-04  
**Approved By**: Project Owner following architecture review  
**Scope**: Domain and integration events across ERP modules and external boundaries

## Context

The ERP is a modular monolith today, but modules need reliable decoupling for notifications, workflows, integrations, and background processing. Events must not create distributed-system complexity before it is necessary, while externally consumed events require durable delivery and versioned contracts.

## Decision

Adopt a transactional-outbox-based event architecture with in-process domain events inside the modular monolith and an extensible external delivery boundary.

1. Modules may publish domain events through an application event contract rather than calling unrelated modules directly for secondary effects.
2. Business state changes and their durable outbox records are committed in the same database transaction.
3. A background dispatcher delivers outbox events to registered handlers and, where required, external brokers/integrations.
4. In-process handlers are idempotent and failures do not silently delete the source event.
5. External event contracts are versioned according to the compatibility rules established by approved ADR-0008.
6. Events carry tenant identity when they represent tenant-owned data. Consumers must establish and enforce tenant context rather than trusting event payloads alone.
7. The outbox is delivery infrastructure, not a replacement for authoritative business tables or audit records.
8. No message broker is required for the initial implementation; a broker can be added behind the dispatcher when throughput or integration topology requires it.

## Rationale

The transactional outbox prevents the classic failure where database state commits but the corresponding event is lost. In-process dispatch preserves modular-monolith simplicity while leaving a clean path to external messaging.

## Alternatives Considered

- **Direct synchronous module calls only** — rejected because secondary workflows become tightly coupled.
- **Message broker from day one** — rejected because it adds operational complexity before scale requires it.
- **Publish directly to a broker inside the business transaction** — rejected because database commit and broker delivery cannot be made atomic by ordinary application code.

## Consequences

- Adds an outbox table and dispatcher/worker responsibility.
- Requires event idempotency, retry, retention, and observability.
- Enables future integrations without forcing the ERP into microservices.

## Implementation Notes

Start with domain events that have clear business ownership. Keep payloads small and versioned. Use stable event IDs for deduplication. Define outbox retention and replay controls before production use.

## Related Documents

- ADR-0008 Event Contracts and Versioning
- ADR-0017 Notification Service
- ADR-0019 Scheduler Service
- `docs/02-architecture/README.md`

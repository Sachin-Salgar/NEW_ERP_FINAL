# ADR-0017: Notification Service

**Date**: 2026-09-04  
**Status**: Proposed  
**Scope**: In-application notification orchestration and delivery abstraction

## Context

ERP modules will need email and eventually other notifications. Notification behavior must not be embedded directly in business services or coupled to a single transport provider.

## Decision

Introduce a centralized Notification Service as an application capability with provider-neutral contracts.

1. Business/application services submit notification intents through a `NotificationService` contract.
2. Notification templates are identified by stable template keys and receive validated structured data rather than arbitrary HTML assembled by callers.
3. Delivery channels are abstracted behind adapters, initially prioritizing email and in-app notifications where required by the product.
4. Notification records and delivery attempts are durable and tenant-aware where applicable.
5. Delivery is asynchronous from the initiating business operation whenever practical; business transactions must not wait on remote mail-provider availability.
6. Delivery operations are idempotent and retryable with bounded retry/backoff policies.
7. Secrets and provider credentials remain in centralized configuration/secret management and never in notification payloads.
8. Cross-module event triggers use the event architecture defined separately; the notification service itself does not become the event bus.

## Rationale

A provider-neutral application boundary prevents vendor lock-in and keeps business logic deterministic. Durable delivery state enables retry and operational visibility without coupling database transactions to external services.

## Alternatives Considered

- **Direct SMTP/provider calls from each module** — rejected due to duplication and coupling.
- **External notification SaaS as the domain API** — rejected because it would make a third-party service authoritative for ERP behavior.
- **Notification as only an in-app UI concern** — rejected because email and other channels are required for operational workflows.

## Consequences

- Adds durable notification state and worker processing.
- Requires template governance and provider adapter configuration.
- Creates a clean foundation for authentication emails and future operational alerts.

## Implementation Notes

Do not require a message broker for the first implementation. A durable database-backed work queue/outbox may be used until scale or integration requirements justify a broker.

## Related Documents

- ADR-0014 Audit Logging Foundation
- ADR-0015 Email Verification and Password Recovery
- ADR-0019 Scheduler Service
- ADR-0020 Event-Driven Architecture

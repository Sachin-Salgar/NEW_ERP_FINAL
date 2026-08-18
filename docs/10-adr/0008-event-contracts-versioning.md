# ADR-0008: Event Contracts and Versioning

**Status**: Proposed  
**Date**: 2026-08-07  
**Decision Owner**: Architecture Review Board  
**Scope**: Versioning and compatibility rules for events that cross module or integration boundaries

## Context

The ERP uses events where asynchronous integration, notifications, background processing, or other decoupled behavior is appropriate. Stable event contracts are required when events cross module or external integration boundaries.

The current backend is a **modular monolith**. Event contracts therefore do not imply independent deployment of business modules. They define a stable integration contract where an event is actually used.

## Problem Statement

How should event contracts be defined, versioned, and evolved so that producers and consumers can change safely without silently breaking existing consumers?

## Alternatives Considered

1. Embedding version numbers in event names, for example `invoice.created.v1`.
2. Using a schema registry with semantic versioning for event payloads.
3. Allowing only strict backward-compatible changes without explicit schema versions.
4. Introducing compatibility/adaptation logic in consumers.

## Decision

**Proposed:** Use a schema-registry approach with explicit event-version metadata for event contracts that require governed versioning.

Event names should remain stable where practical. The event version identifies the payload contract used by the producer. Producers should publish business events only after the authoritative transaction has successfully committed, using an implementation that prevents publication of events for rolled-back transactions.

Consumers must declare the versions they support and must tolerate additive fields they do not use.

This ADR does not mandate a specific schema format or schema-registry product until those implementation choices are approved.

## Compatibility Rules

- Additive, optional fields are preferred for backward-compatible evolution.
- Removing or renaming a required field is a breaking change.
- Changing the meaning of an existing field is a breaking change even if its data type is unchanged.
- Consumers must not assume that unknown fields are errors.
- Breaking contract changes require a new event version and an explicit migration/deprecation plan.
- Producers must not publish a contract version that has not passed the required compatibility checks.

## Consequences

### Positive

- Clear contract ownership and compatibility rules.
- Safer evolution of module and integration boundaries.
- Consumers can migrate to newer versions deliberately.

### Negative

- Requires schema governance and compatibility testing.
- A schema registry introduces operational infrastructure if the proposal is approved.
- Multiple supported versions can temporarily increase maintenance effort.

## Implementation Notes / TODOs

- Select a schema format (JSON Schema, Avro, Protobuf, or another approved format).
- Decide whether the registry is an internal platform capability or an external product.
- Define event ownership and compatibility approval workflow.
- Add automated backward/forward compatibility tests where applicable.
- Define retention and deprecation rules for old event versions.
- Define the transaction-to-event publication mechanism, such as an outbox pattern, before implementation.

## Related Documents

- [Event-Driven Architecture](../04-backend/12-event-driven-architecture.md)
- [ADR Index](./README.md)

## Authority

This ADR remains **Proposed**. It must not be treated as implementation authority until approved. Where it conflicts with an approved ADR or canonical architecture document, follow the repository ADR authority rules and **STOP and ask** if the conflict cannot be resolved unambiguously.

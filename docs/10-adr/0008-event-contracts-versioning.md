# ADR-0008: Event Contracts and Versioning

Status: Proposed

Date: 2026-08-07

Decision Owner: TODO (Architecture Review Board)

## Context

The Enterprise ERP Platform adopts an Event-Driven Architecture (Volume 3 — Chapter 13). Business events are published between modules and to external integrations. Stable event contracts are required to prevent breaking changes and to support independent deployability and evolution of producers and consumers.

## Problem Statement

How should event contracts be defined, versioned, and evolved to ensure backward compatibility while allowing necessary enhancements?

## Alternatives Considered

1. Embedding version numbers in event names (e.g., invoice.created.v1).
2. Using schema registry with semantic versioning for payloads.
3. Maintaining strict backward-compatible changes only (no versioning).
4. Introducing an event compatibility layer in consumers.

## Decision

Use a schema registry approach combined with semantic versioning for event payloads, and include an Event Version field in each event header. Event names remain stable; the Event Version indicates the schema used. Producers publish events only after successful transaction commit. Consumers must declare supported versions and handle unknown fields gracefully.

## Consequences

Pros:
- Clear compatibility rules.
- Ability to evolve payloads using additive changes.
- Consumers can opt-in to newer versions.

Cons:
- Requires operational infrastructure (schema registry).
- Additional governance overhead for schema approval.

## Implementation Notes / TODOs

- Select a schema format (JSON Schema / Avro / Protobuf) — TODO: ARB decision.
- Implement a schema registry (internal or external) and publish initial event schemas.
- Define governance process for event contract changes and approvals.
- Add tests for backward/forward compatibility.

Cross References

- docs/04-backend/12-event-driven-architecture.md
- docs/10-adr/README.md


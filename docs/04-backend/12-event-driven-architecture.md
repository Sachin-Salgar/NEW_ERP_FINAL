# Event-Driven Architecture

**Document Purpose:** Define event-driven architecture for the Enterprise ERP Platform.

---

## Introduction

Not every business operation should execute synchronously within a single request.
Many ERP processes require notifying other modules, triggering workflows, updating reports, sending notifications, or integrating with external systems. Performing all of these tasks during the original request increases response time and creates unnecessary dependencies.

The Enterprise ERP Platform uses events where asynchronous or loosely coupled processing is appropriate. Within the modular monolith, events complement published module contracts; they do not require HTTP calls between internal modules or imply a distributed microservice architecture.

## Objectives

The Event-Driven Architecture aims to:
- Reduce module coupling.
- Improve scalability.
- Support asynchronous processing.
- Enable business automation.
- Simplify future microservice migration.
- Improve maintainability.

## Business Events

A business event represents something significant that has occurred within the system.
Examples include:
- Customer Created
- Customer Updated
- Sales Invoice Created
- Sales Invoice Approved
- Sales Invoice Posted
- Purchase Order Approved
- Goods Received
- Payment Received
- Employee Created
- Leave Approved
- Payroll Processed

Business events describe facts that have already occurred.

## Event Lifecycle

Illustrative flow:

Business Operation

↓

Transaction Committed

↓

Event Made Available for Publication

↓

Subscribers Process Event

↓

Business Actions Executed

Events representing committed business state shall not be published to subscribers as successfully completed before the associated transaction commits. Where reliable publication is required, the implementation shall use an appropriate transactional publication mechanism such as an outbox pattern rather than assuming that an in-process event dispatch is automatically atomic with the database transaction.

## Event Publisher

Each module may publish events describing important business activities.
Examples:
Sales Module:
- Invoice Created
- Invoice Posted

Inventory Module:
- Stock Reserved
- Stock Released

Finance Module:
- Payment Posted
- Journal Entry Created

Only events that are meaningful to other modules should be published.

## Event Subscribers

Modules may subscribe to events published by other modules.
Example:

Sales Invoice Posted

↓

Inventory Module

↓

Reduce Stock

↓

Finance Module

↓

Create Ledger Entries

↓

Notification Module

↓

Notify Customer

Subscribers remain independent from the publishing module and must process events according to their own business rules.

## Event Contracts

Each event shall define:
- Event Name.
- Event Version.
- Event Timestamp.
- Organization/Tenant Context where applicable.
- Event Payload.
- Correlation Identifier where applicable.

Stable event contracts prevent breaking integrations.

## Event Ordering

Where business consistency depends upon event order, the required ordering shall be explicitly defined and enforced by the event-processing mechanism.
Examples:
- Payment Posted before Receipt Generated.
- Invoice Approved before Invoice Posted.

Event ordering requirements shall be documented for each business workflow.

## Event Idempotency

Event handlers shall be idempotent.
Processing the same event multiple times shall not produce duplicate business operations.
Examples:
- Duplicate stock deduction shall not occur.
- Duplicate journal entries shall not be created.
- Duplicate notifications shall not be sent.

## Summary

The Event-Driven Architecture enables loose coupling between ERP modules while supporting automation, scalability, and future architectural evolution.
Events form a mechanism for asynchronous business processing; their use does not change the modular-monolith deployment model.

---

## Cross References

- [Background Jobs & Queue Processing](./13-background-jobs-queue-processing.md)
- [Service Layer Design](./08-service-layer-design.md)
- [ADR Index](../10-adr/README.md)

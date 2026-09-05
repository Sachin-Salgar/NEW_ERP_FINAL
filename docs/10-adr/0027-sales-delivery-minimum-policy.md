# ADR-0027: Sales Delivery Minimum Policy

**Date:** 2026-09-05  
**Status:** Approved for initial Sales Delivery implementation  
**Scope:** Sales-owned delivery traceability without Inventory execution

## Decision

Sales Deliveries are created only from a `CONFIRMED` Sales Order in the active
tenant, organization, branch, and financial-year context. Creation snapshots
the order customer and all order lines. A delivery is unique per order and
context; repeated creation with the same idempotency key returns the existing
delivery.

Sales owns delivery traceability and lifecycle state:

`DRAFT -> DISPATCHED -> DELIVERED -> COMPLETED`

`DRAFT` and `DISPATCHED` may be cancelled. Finalized deliveries are immutable.
Sales does not reserve stock, pick, issue, or mutate Inventory records because
no published Inventory provider contract exists in the repository. Those
operations remain an explicit integration boundary.

Delivery numbers use the existing tenant/organization `code_counters`
sequence. All mutations require the authenticated session context and an
expected version for optimistic concurrency.

## Consequences

The initial slice provides auditable, tenant-safe delivery traceability and
prevents duplicate deliveries without claiming Inventory success. Inventory
integration can be added through a provider contract without changing Sales
ownership or the persisted organizational context.

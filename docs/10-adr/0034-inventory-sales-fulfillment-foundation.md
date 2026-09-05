# ADR-0034: Minimum Inventory Foundation for Sales Fulfillment

**Status:** Approved for the bounded implementation milestone  
**Date:** 2026-09-05  
**Scope:** Organization-scoped Inventory warehouse, stock, reservation, fulfillment, and return contracts used by Sales.

## Context

Sales requires a real Inventory boundary for confirmed-order reservation,
delivery fulfillment, and return stock movement. The Inventory architecture
does not yet define the minimum operational semantics for these integrations.

## Decision

1. Warehouses are tenant-owned records belonging to exactly one organization.
2. Warehouses have explicit `ACTIVE` and `INACTIVE` states. Inactive warehouses
   cannot receive stock, create reservations, fulfill reservations, or process
   returns.
3. The bounded stock balance is keyed by tenant, organization, warehouse, and
   item. Item Master remains the owner of item identity and base unit of measure.
4. Stock exposes `on_hand`, `reserved`, and `available`, where
   `available = on_hand - reserved`. `on_hand` and `reserved` are never
   negative, and `reserved` cannot exceed `on_hand`.
5. A receipt increases `on_hand` and creates an immutable receipt movement.
6. A reservation moves quantity from available to reserved without changing
   on-hand. The first implementation is all-or-nothing; partial reservation
   and backorder behavior are deferred.
7. Reservation release decreases reserved without changing on-hand.
8. Fulfillment decreases both on-hand and reserved and creates an immutable
   issue movement. Fulfillment is idempotent by reservation and operation key.
9. A return increases on-hand and creates an immutable return movement.
10. Reservation, fulfillment, and return source references are generic
    `(source_type, source_id)` values. Inventory does not depend on Sales
    private tables.
11. Reservation and fulfillment operations execute in a database transaction
    with row locking. Retries with the same source/operation key return the
    existing result and do not duplicate state changes.
12. Transaction-facing reservations preserve the authenticated organization,
    branch, and financial-year context. Tenant authority comes only from the
    authenticated server context.

## Deferred

Bin/location hierarchy, batch and serial tracking, valuation/costing,
replenishment, advanced ATP, partial reservation, backorders, and Finance
effects remain outside this bounded decision.

## Consequences

Inventory owns stock and movement state; Sales only invokes typed provider
contracts. The bounded policy is sufficient to activate confirmed-order
reservation, delivery fulfillment, and return movement without inventing
advanced warehouse or accounting behavior.

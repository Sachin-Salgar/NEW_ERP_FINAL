# ADR-0036: Sales Delivery Inventory Fulfillment

**Date:** 2026-09-05  
**Status:** Approved for the bounded Sales/Inventory activation

## Decision

Sales Delivery creation requires active Inventory reservations for the source
Sales Order. Delivery lines copy the Item Master identity and persist the
corresponding Inventory reservation reference. The Sales Order warehouse is
copied to the delivery header.

Completing a delivery fulfills all reservations for the source Sales Order
through the provider-neutral Inventory boundary. Partial delivery, backorders,
and multi-warehouse allocation remain deferred. The operation is idempotent by
delivery operation key and is executed within the existing transaction context;
any Inventory failure prevents the Sales completion transition.

## Consequences

Sales owns delivery lifecycle and traceability. Inventory owns reservation
state, stock mutation, and issue movements. Historical deliveries without the
new references remain readable but cannot be completed through the
Inventory-backed path until an approved reclassification operation exists.

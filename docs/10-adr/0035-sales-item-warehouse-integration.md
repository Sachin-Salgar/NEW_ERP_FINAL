# ADR-0035: Sales Item and Warehouse Integration

**Date:** 2026-09-05  
**Status:** Approved for the bounded Sales/Inventory integration milestone

## Decision

Sales transaction-facing lines reference Item Master through a nullable
`item_id` during the additive migration. Existing quotation, order, and
delivery rows remain unchanged when no authoritative item identity exists;
they are not backfilled by inference. New order conversion requires every
source line to have an active, sales-eligible Item Master item in the active
organization.

Sales Orders carry an organization-owned Inventory `warehouse_id`. New order
conversion requires an active warehouse in the authenticated organization.
Warehouse and item identity are copied to order lines as immutable transaction
references. Sales does not calculate stock or write Inventory persistence.

Confirming an order remains a Sales lifecycle transition. The application then
requests Inventory reservations using the provider-neutral
`source_type = SALES_ORDER` and the Sales Order ID as the source. A failed
reservation leaves the order confirmed but not reserved and is retryable
through the explicit reservation operation; no false reservation state is
persisted.

## Consequences

Inventory remains authoritative for stock, reservation, fulfillment, and
movement state. Historical Sales records without item or warehouse identity
remain visible but cannot enter new Inventory-backed flows until an approved
reclassification operation exists. Multi-line orders use one reservation per
order line while retaining the common Sales Order source.

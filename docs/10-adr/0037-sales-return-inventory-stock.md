# ADR-0037: Sales Return Inventory Stock Integration

- Date: 2025-03-08
- Status: Accepted

## Context

Sales returns were previously persisted with an explicit `NOT_CONNECTED` Inventory
status. Inventory already owns return movements and stock balances, while Sales
owns the return lifecycle.

## Decision

New returns are created from an issued invoice and its completed delivery. The
delivery warehouse and Item Master identity are copied as nullable historical
references. Processing a return requires those references and invokes Inventory's
provider-neutral `returnStock` operation once per line using a deterministic
idempotency key. Inventory completion and the Sales lifecycle transition run in
the same transaction. Inventory failure rolls back processing. Historical rows
without the references remain preserved and cannot enter the Inventory-backed
processing path.

## Consequences

Inventory remains the sole owner of stock increases and movement audit records.
Return quantities are bounded by the source invoice line for this bounded slice;
partial returns and multiple returns per invoice remain governed by the existing
Sales Return policy and are not broadened here.

Advanced inspection, disposition, replacement, and warehouse re-routing are
deferred.

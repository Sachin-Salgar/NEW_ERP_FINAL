# ADR-0029: Sales Return Minimum Policy

**Date:** 2026-09-05  
**Status:** Approved for initial Sales Return implementation

## Decision

Sales Returns are created from an `ISSUED` Sales Invoice in the active
tenant/organization/branch/financial-year context. They snapshot invoice lines
and requested quantities. One return is allowed per invoice and idempotency key
is unique per context; quantity validation and duplicate prevention remain
Sales-owned.

The lifecycle is:

`REQUESTED -> INSPECTED -> APPROVED -> PROCESSED -> CLOSED`

`INSPECTED -> REJECTED` and `REQUESTED -> CANCELLED` are terminal paths.
Inventory inspection/stock movement and Finance adjustment are not connected in
the repository; `PROCESSED` is therefore an auditable Sales coordination state
with explicit `inventory_status` and `finance_status` of `NOT_CONNECTED`.

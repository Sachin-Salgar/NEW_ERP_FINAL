# ADR-0028: Sales Invoice Minimum Policy

**Date:** 2026-09-05  
**Status:** Approved for initial Sales Invoice implementation

## Decision

Sales Invoices are created only from a `COMPLETED` Sales Delivery in the
authenticated tenant, organization, branch, and financial-year context. The
invoice snapshots the delivery customer and lines. A delivery can produce only
one invoice in that context, and an idempotency key is unique in that context.

Sales owns invoice traceability and the document lifecycle:

`DRAFT -> ISSUED`

`DRAFT -> CANCELLED` is allowed. Issued invoices are immutable and cannot be
cancelled or edited by the Sales slice.

Invoice numbering uses the existing tenant/organization `code_counters`
sequence. The initial repository has no Finance or Tax implementation. The
invoice therefore records `finance_status = NOT_CONNECTED` and
`tax_status = NOT_CONNECTED`; it does not write Finance or Tax tables and does
not claim accounting posting or authoritative tax calculation.

## Consequences

The implementation provides deterministic, auditable billing traceability while
keeping Finance and Tax ownership explicit. Provider references and snapshots
can be populated by future contracts without changing invoice ownership or
organizational context.

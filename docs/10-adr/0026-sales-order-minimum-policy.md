# ADR-0026: Sales Order Minimum Policy

**Date:** 2026-09-05  
**Status:** Approved  
**Scope:** First Sales Order backend vertical slice

## Decision

Sales Orders are created only by converting an `ACCEPTED` Sales Quotation.
The conversion preserves the quotation link and snapshots its customer and
items. Orders use the lifecycle `DRAFT -> CONFIRMED -> CANCELLED`; `CLOSED`
is available for delivery compatibility. No inventory reservation is performed
in this slice; future reservation uses an owner-neutral provider boundary.
Order numbers are server-generated with the tenant/organization `code_counters`
sequence and are collision-safe. Tenant, organization, branch, and financial
year ownership are immutable. Orders use canonical audit, optimistic versioning,
and draft-only soft deletion consistent with quotations.

## Consequences

Direct-entry orders, inventory writes, delivery, invoicing, pricing, tax, and
workflow approvals remain out of scope until separately approved.

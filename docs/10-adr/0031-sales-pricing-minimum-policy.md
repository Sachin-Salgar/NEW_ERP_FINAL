# ADR-0031: Sales Pricing Minimum Policy

**Status:** Approved for the bounded Sales implementation  
**Date:** 2026-09-05

Sales owns the initial pricing capability until an authoritative Pricing module
exists. A price list is organization-scoped, optionally branch-scoped, and
contains effective-dated item prices. Only `PUBLISHED` lists are eligible.
The most specific applicable list (branch, then organization) wins; ties are
rejected rather than selected arbitrarily. Customer and Inventory item-master
integration remain explicit future boundaries.

Pricing records are tenant/RLS scoped, auditable, versioned, and protected by
optimistic concurrency. Transaction documents must snapshot a resolved price;
this slice exposes deterministic price-list administration and does not mutate
existing invoices.

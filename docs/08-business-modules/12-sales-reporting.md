# Sales Reporting and Analytics Specification

**Status:** Authorization package — reporting contract required
**Owner:** Reporting/BI platform; Sales supplies domain facts

## 1. Scope

The architecture names Sales Summary, Sales by Customer/Product/Branch,
Salesperson Performance, Pending Orders, Outstanding Deliveries, quotation
reports, order fulfillment reports, invoice registers/aging, and return/credit
history. The current repository does not define report dimensions, measures,
period semantics, source-of-truth ownership, or performance requirements.

## 2. Required read-model contract

Reporting must publish a read-only, tenant-safe contract defining report ID,
allowed filters, dimensions, measures, date basis, currency basis, pagination
or export behavior, freshness, authorization, and source version. Cross-module
metrics must identify whether Sales, Finance, Inventory, Tax, or Reporting is
authoritative.

No report may mutate Sales records. Report queries must be tenant-scoped,
organization-authorized, RLS-protected where backed by tenant data, and
deterministically ordered.

## 3. API/frontend/test requirements

Candidate base path `/api/v1/sales/reports` is not authorized until the
reporting contract defines endpoint names, permissions, schemas, errors,
pagination, filters, exports, and asynchronous job behavior.

Flutter reporting screens require loading/empty/error/filter/pagination/export
states and permission-aware navigation. Backend remains authoritative.

Tests must cover authentication, report permission, tenant/org isolation,
cross-tenant GET/LIST, deterministic results, stale/freshness behavior,
provider failure, audit/access logging, and non-mutation.

**DEPENDENCY CONTRACT REQUIRED** and **BUSINESS DECISION REQUIRED**.

## IMPLEMENTATION STATUS

**DEPENDENCY CONTRACT REQUIRED** and **BUSINESS DECISION REQUIRED**.

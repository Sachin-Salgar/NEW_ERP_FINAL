# Sales Discounts Specification

**Status:** IMPLEMENTED — BOUNDED FOUNDATION AND TRANSACTION SNAPSHOTS
**Owner:** Sales, with Workflow/Pricing dependencies

## 1. Purpose and scope

Discounts represent authorized reductions applied to Sales documents. The
architecture mentions manual, promotional, volume, and configured discounts,
but does not define formulas, stacking, rounding, limits, or approval policy.

## 2. Entities and database design

A discount may be a transaction snapshot or a reusable rule. Candidate
entities are `sales_discount_rules` and document-level/line-level discount
snapshots. Exact table ownership, fields, types, percentages versus amounts,
scope, effective periods, stacking, rounding, tax order, and deletion are
**BUSINESS DECISION REQUIRED**.

All transaction snapshots require tenant/org ownership, mandatory branch and
financial-year references, source-document linkage, canonical
`version_number`/audit metadata, and immutability after finalization. The
mandatory branch and financial-year references follow the organizational-
isolation standard; their business semantics remain **BUSINESS DECISION
REQUIRED**.

## 3. Lifecycle, API, permissions

Discount rule lifecycle, approval thresholds, override roles, and whether
discounts are priced by a separate Pricing provider are **BUSINESS DECISION
REQUIRED**. Generic status mutation is prohibited.

Candidate endpoints are `/api/v1/sales/discount-rules` CRUD plus explicit
publish/archive/approve operations. Candidate permissions are
`sales.discount.read`, `create`, `update`, `approve`, `publish`, and
`override`. Exact contracts and errors require approval.

## 4. Frontend, security, and tests

Flutter renders backend-calculated discounts and exposes actions only for
authorized users. Tests must cover unauthorized overrides, tenant/org
isolation, RLS, rounding/stacking decisions, immutable snapshots, concurrency,
audit, rollback, and Workflow/Pricing boundary failures.

Sales owns percentage-based, non-stacking, organization-scoped discount rules.
Rules are draft, published, or archived and are effective-dated. Workflow
approval, tax ordering, and transaction snapshots remain integration boundaries.

## IMPLEMENTATION STATUS

**IMPLEMENTED — BOUNDED FOUNDATION AND TRANSACTION SNAPSHOTS.** Published,
effective-dated, organization-scoped percentage rules resolve deterministically
and do not stack. Quotation creation and draft updates persist the resolved
discount percentage and amount; order and invoice conversion copies those
snapshots. Workflow approval remains dependency-gated, and tax calculation stays
with the authoritative Tax capability.

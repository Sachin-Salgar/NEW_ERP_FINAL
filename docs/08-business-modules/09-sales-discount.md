# Sales Discounts Specification

**Status:** Authorization package — implementation specification
**Owner:** Sales/Workflow/Pricing boundary

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

All transaction snapshots require tenant/org ownership, source-document
linkage, version/audit metadata, and immutability after finalization.

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

**BUSINESS DECISION REQUIRED** and **DEPENDENCY CONTRACT REQUIRED**.

## IMPLEMENTATION STATUS

**BUSINESS DECISION REQUIRED** and **DEPENDENCY CONTRACT REQUIRED**.

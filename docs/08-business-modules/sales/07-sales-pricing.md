# Sales Pricing and Price Lists Specification

**Status:** IMPLEMENTED — BOUNDED FOUNDATION
**Owner:** Sales, unless a separate authoritative Pricing capability is
established by approved architecture
**Dependencies:** CRM/Customer, Inventory Item Master, Tax where applicable

## 1. Purpose and scope

Pricing supplies backend-authoritative prices to Sales documents. The
architecture names standard, customer, contract, promotional, volume, and
multiple price-list pricing but does not define precedence, effective dates,
currency, item eligibility, or calculation policy.

## 2. Entities and database design

Pricing is currently treated as a Sales capability; no separate authoritative
Pricing module has been established. A separate owner or module requires an
approved architecture decision and dependency contract.

Implemented entities are `sales_price_lists` and `sales_price_list_items`.
Potential fields include UUIDv7 IDs, tenant/org ownership, mandatory branch and
financial-year references where the records are transactional, name/code,
status, currency, effective period, customer/customer-group scope, item
reference, unit, price, minimum quantity, and canonical audit/version metadata.

Table names, field types, requiredness, precedence, currency, overlapping
period behavior, customer-group ownership, item-master contract, uniqueness,
soft deletion, branch/financial-year semantics, and financial-year relationship
are **BUSINESS DECISION REQUIRED**. Mandatory branch and financial-year
references for transactional records follow the organizational-isolation
standard. Price snapshots used on transactions must be immutable.

## 3. API and authorization

Candidate base path `/api/v1/sales/price-lists` with list/detail/create/update
and item-management endpoints. Exact endpoints, permissions, schemas, error
conditions, pagination, search, and whether client users may select a list are
**BUSINESS DECISION REQUIRED**.

Candidate permissions: `sales.pricing.read`, `create`, `update`, `publish`,
and `archive`.

## 4. Frontend, security, and tests

Flutter requires price-list list/detail/edit screens only after policy is
approved, with loading/empty/error/search/pagination and permission-aware
actions. Sales documents consume server results and never calculate prices in
Flutter.

Tests must cover tenant/org isolation, RLS/FORCE RLS, overlap/precedence
decisions, version-number conflicts, immutable transaction snapshots,
authorization, canonical audit metadata, rollback, and unavailable Item
Master/CRM contracts.

## 5. Integration boundary

Customer scope uses CRM contracts; item identity uses Inventory/Item Master;
tax is not calculated here. A published Pricing contract is required before
Sales documents can depend on this capability.

Sales owns organization/branch-scoped, effective-dated price-list administration
until a separate Pricing module is approved. Lists transition from `DRAFT` to
`PUBLISHED` to `ARCHIVED`; published lists are immutable. Tax, customer-specific
pricing, and item-master lookup remain explicit integration boundaries.

## IMPLEMENTATION STATUS

**IMPLEMENTED — BOUNDED FOUNDATION.** Published lists resolve effective-dated
provider-neutral item prices, with branch-specific precedence and overlap
rejection. Inventory Item Master, CRM customer scope, and immutable transaction
price snapshots remain **PENDING DEPENDENCY**.

# Sales Pricing and Price Lists Specification

**Status:** Authorization package — implementation specification
**Owner:** Pricing capability boundary
**Dependencies:** CRM/Customer, Inventory Item Master, Tax where applicable

## 1. Purpose and scope

Pricing supplies backend-authoritative prices to Sales documents. The
architecture names standard, customer, contract, promotional, volume, and
multiple price-list pricing but does not define precedence, effective dates,
currency, item eligibility, or calculation policy.

## 2. Entities and database design

Candidate entities are `sales_price_lists` and `sales_price_list_items`.
Potential fields include UUIDv7 IDs, tenant/org ownership, name/code, status,
currency, effective period, customer/customer-group scope, item reference,
unit, price, minimum quantity, and audit/version metadata.

Table names, field types, requiredness, precedence, currency, overlapping
period behavior, customer-group ownership, item-master contract, uniqueness,
soft deletion, and financial-year relationship are **BUSINESS DECISION
REQUIRED**. Price snapshots used on transactions must be immutable.

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
decisions, version conflicts, immutable transaction snapshots, authorization,
audit, rollback, and unavailable Item Master/CRM contracts.

## 5. Integration boundary

Customer scope uses CRM contracts; item identity uses Inventory/Item Master;
tax is not calculated here. A published Pricing contract is required before
Sales documents can depend on this capability.

**BUSINESS DECISION REQUIRED** and **DEPENDENCY CONTRACT REQUIRED**.

## IMPLEMENTATION STATUS

**BUSINESS DECISION REQUIRED** and **DEPENDENCY CONTRACT REQUIRED**.

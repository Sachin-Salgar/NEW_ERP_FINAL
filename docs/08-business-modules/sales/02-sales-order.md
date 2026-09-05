# Sales Order Management Specification

**Status:** Backend slice implemented under ADR-0026; Item Master and warehouse
contract implemented under ADR-0035; reservation activation is available through
the Inventory boundary
**Owner:** Sales
**Dependencies:** Core Enterprise, CRM/Customer, Inventory, Finance, Tax, Workflow

## 1. Purpose and scope

Sales Orders record customer commitments created from an accepted quotation or
through an authorized direct-entry path. Sales owns the order and its lifecycle;
Inventory owns stock and reservation state; Finance owns accounting and
receivables; Tax owns tax calculation; Workflow owns approvals.

The architecture establishes these concepts but does not establish enough
business policy to implement them safely. The unresolved decisions are listed
in Section 19.

## 2. Proposed domain model (subject to decisions)

### Header: `sales_orders`

| Field | Type | Required | Authority/relationship |
|---|---|---:|---|
| `id` | UUIDv7 | yes | primary key |
| `tenant_id` | UUID | yes | authenticated tenant; immutable |
| `organization_id` | UUID | yes | active authorized organization |
| `branch_id` | UUID | mandatory reference; semantics decision | Core branch in same organization |
| `warehouse_id` | UUID | required for new order conversion | Active Inventory warehouse in the same organization |
| `financial_year_id` | UUID | mandatory reference; semantics decision | financial-year contract |
| `order_number` | text | yes | server-generated, scope pending |
| `customer_id` | UUID | yes | CRM Customer contract |
| `quotation_id` | UUID | optional | Sales quotation contract; historical link |
| `currency` | text | decision | currency contract |
| `shipping_address` | JSONB | decision | address contract |
| `billing_address` | JSONB | decision | address contract |
| `delivery_schedule` | JSONB | decision | delivery contract |
| `payment_terms` | JSONB | decision | Finance contract |
| `status` | enum | yes | server-controlled lifecycle |
| `version_number` | integer | yes | optimistic concurrency |
| `created_by/created_at` | UUID/timestamptz | yes | audit metadata |
| `updated_by/updated_at` | UUID/timestamptz | yes | canonical audit metadata |
| `deleted_by/deleted_at/is_deleted` | UUID/timestamptz/boolean | decision | only if approved |

### Detail: `sales_order_items`

Required baseline: UUIDv7 `id`, `tenant_id`, `organization_id`, `order_id`,
line number, Item Master `item_id`, description snapshot, quantity, unit of
measure, unit price, discount reference, tax reference, and canonical audit
columns (`created_at`, `created_by`, `updated_at`, `updated_by`,
`version_number`).
Historical lines may retain a null `item_id`; new Inventory-backed order
conversion requires it. Exact monetary types, tax snapshots, discount snapshots, and whether
services are allowed are **BUSINESS DECISION REQUIRED**.

Header/detail rows require composite tenant/organization foreign-key integrity,
unique line numbers per order, and no orphan details.

Transactional Sales records must include the mandatory `tenant_id`,
`organization_id`, `branch_id`, and `financial_year_id` references required by
the organizational-isolation standard. The exact branch and financial-year
business semantics remain **BUSINESS DECISION REQUIRED**.

## 3. Lifecycle and authorization

The architecture names Draft, Approved, Inventory Reserved, Ready for Delivery,
Partially Delivered, Fully Delivered, and Closed. It does not define all
transitions, cancellation rules, amendment rules, approval actors, or whether
reservation is automatic. These are **BUSINESS DECISION REQUIRED**.

No generic status PATCH is permitted. Each approved transition requires a
dedicated application operation, permission, audit event, transaction, and
version check. Finalized/closed orders are immutable; corrections use an
approved amendment or cancellation operation.

Candidate permission keys require approval before registration:
`sales.order.read`, `create`, `update`, `delete`, `approve`, `reserve`,
`amend`, `cancel`, `close`, and `convert`.

## 4. Validation, numbering, concurrency, deletion

- Customer, quotation, branch, warehouse, and financial-year references must
  belong to the authenticated tenant and authorized organization.
- Tenant identity never comes from request data.
- Quantity, price, tax, discount, address, date, currency, and payment-term
  rules are **BUSINESS DECISION REQUIRED**.
- Order numbers must be server-generated, unique, collision-safe, and scoped
  according to an approved numbering policy.
- Updates use an expected version and return a conflict on stale versions.
- Soft deletion is **BUSINESS DECISION REQUIRED** and cannot apply to a
  finalized order.
- Every mutation and transition is audited in the same transaction.

## 5. API contract

Base path: `/api/v1/sales/orders`. All endpoints require authentication,
`sales` module enablement, active organization authorization, and the relevant
approved permission.

Required endpoint families:

`POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` (only if approved),
and explicit transition endpoints for each approved lifecycle operation.

Create/update request schemas, transition names, response fields, status
codes, and error codes are **BUSINESS DECISION REQUIRED**. List must use the
existing deterministic pagination envelope and support approved search/filter
fields without exposing tenant authority.

## 6. Database and security requirements

Use the existing migration system, UUIDv7, header/detail integrity,
tenant-local transaction context, RLS and FORCE RLS. Policies must prevent
cross-tenant SELECT/INSERT/UPDATE/DELETE and enforce organization scoping
through application authorization and composite relationships. Restricted
`NOSUPERUSER NOBYPASSRLS` integration tests are mandatory.

## 7. Frontend and tests

Flutter requires service/models, list/create/detail/edit screens where
permitted, explicit lifecycle actions, loading/empty/error states,
pagination/search/filter, canonical Router 2.0 metadata, module guards, and
permission-aware controls. Flutter never authorizes, calculates totals, or
changes status locally.

Tests must cover authentication, permissions, module enablement, CRUD,
cross-tenant and cross-organization GET/LIST/PATCH/DELETE, RLS, lifecycle and
invalid transitions, version conflicts, numbering concurrency, immutability,
audit, rollback, and every integration failure boundary.

## 8. Integration boundary

Quotation conversion uses the Sales quotation contract and preserves a
historical quotation link. Reservation uses the Inventory contract; no Sales
code may write Inventory tables. Tax, payment terms, credit checks, approvals,
and accounting use their owning contracts.

## IMPLEMENTATION STATUS

**IMPLEMENTED — MINIMUM BACKEND POLICY** — ADR-0026 authorizes accepted
quotation conversion, DRAFT/CONFIRMED/CANCELLED/CLOSED lifecycle, immutable
transaction context, server numbering, audit/versioning, and no direct Inventory
writes. ADR-0035 adds additive Item Master and warehouse references. Confirmed
orders can request idempotent Inventory reservations; failures leave the order
confirmed but not falsely marked reserved. Historical lines without item
identity remain excluded from new Inventory-backed flows.

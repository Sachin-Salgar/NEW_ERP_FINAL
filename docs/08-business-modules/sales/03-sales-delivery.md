# Sales Delivery and Shipment Management Specification

**Status:** Backend slice implemented under ADR-0027; Inventory execution deferred
**Owner:** Sales
**Dependencies:** Sales Order, Inventory, Workflow, Notification, Document

## 1. Purpose and scope

Sales Delivery records the Sales-side fulfillment document and its traceability
to an order. Inventory remains authoritative for picking, stock movement,
availability, and warehouse execution. Logistics-provider behavior is outside
Sales unless a published contract exists.

## 2. Entities and database design

### Header: `sales_deliveries`

Required candidates: UUIDv7 `id`, `tenant_id`, `organization_id`, mandatory
`branch_id`, `financial_year_id`, `warehouse_id`, `delivery_number`, `sales_order_id`, `customer_id`,
delivery date, priority, shipping method, carrier/tracking references, status,
`version_number`, canonical `created_at`, `created_by`, `updated_at`,
`updated_by`, and approved deletion metadata.

### Detail: `sales_delivery_items`

Required candidates: UUIDv7 `id`, tenant/org IDs, mandatory branch and
financial-year references, `delivery_id`, `order_item_id`, line number, ordered
quantity snapshot, delivered quantity, unit of measure, and canonical audit
columns.

Exact types, requiredness, address structure, priority values, carrier fields,
financial-year relationship semantics, and whether a delivery may be deleted
are bounded for the initial slice by ADR-0027. The mandatory branch and financial-year
references follow the organizational-isolation standard; their business
semantics remain unresolved. Composite tenant/org foreign keys, unique line
numbers, and orphan prevention are mandatory.

## 3. Lifecycle and rules

The architecture illustrates Picking, Packing, Dispatch, In Transit, Delivered,
and Completed. Exact states, partial-delivery rules, cancellation, reversal,
who may transition, and whether Sales or Inventory owns each execution step are
**BUSINESS DECISION REQUIRED**.

Finalized delivery history is immutable. Corrections use an approved reversal
or amendment path. Delivery quantities must be validated against the order and
the Inventory response; Sales must not infer stock state.

Candidate permissions requiring approval:
`sales.delivery.read`, `create`, `update`, `pick`, `pack`, `dispatch`,
`ship`, `deliver`, `complete`, `cancel`, and `reverse`.

## 4. API, frontend, security, and tests

Base path: `/api/v1/sales/deliveries`; required families are create, list,
detail, permitted amendment, and explicit lifecycle operations. Request and
response schemas, status codes, filters, numbering scope, and idempotency keys
are **BUSINESS DECISION REQUIRED**.

Flutter requires list/create/detail/edit-if-approved screens, lifecycle
actions, loading/empty/error/pagination/search/filter states, route metadata,
module guards, and permission-aware controls.

Use tenant-local transactions, RLS/FORCE RLS, server-side organization
authorization, and restricted-role tests. HTTP tests must cover cross-tenant
and cross-organization GET/LIST/PATCH/DELETE, invalid transitions, quantity
and duplicate prevention, concurrent updates, audit, rollback, and Inventory
contract failures.

## 5. Integration boundary

Sales requests reservation, picking, issue, and delivery confirmation through
published Inventory contracts. Inventory owns stock movement. Notifications,
documents, and workflow use their owning contracts and durable transaction
boundaries.

## IMPLEMENTATION STATUS

**IMPLEMENTED — MINIMUM BACKEND POLICY** — ADR-0027 provides confirmed-order
conversion, delivery-line snapshots, deterministic numbering, idempotent
creation, explicit lifecycle, audit/versioning, and RLS/FORCE RLS. Inventory
reservation, picking, stock issue, and logistics execution remain deferred
until their provider contracts are published.

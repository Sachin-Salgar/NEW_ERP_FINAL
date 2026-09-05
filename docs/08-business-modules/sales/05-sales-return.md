# Sales Returns Specification

**Status:** Backend slice implemented under ADR-0029; Inventory/Finance providers not connected
**Owner:** Sales
**Dependencies:** Sales Invoice, Delivery, Inventory, Finance, Workflow

## 1. Purpose and scope

Sales Returns coordinate a customer return request and its commercial
traceability. Inventory owns inspection disposition and stock movement. Finance
owns financial adjustment. Sales owns the return request and coordination
state.

## 2. Entities and database design

### Header: `sales_returns`

Candidate fields: UUIDv7 `id`, tenant/org IDs, mandatory branch, warehouse, and
financial-year IDs, `return_number`, customer ID, invoice ID, delivery ID,
return date, reason reference, inspection status, approval status, return
status, `version_number`, and canonical audit/deletion metadata.

### Detail: `sales_return_items`

Candidate fields: UUIDv7 `id`, tenant/org IDs, mandatory branch and financial-year
references, `return_id`, source invoice or delivery item reference, line number,
requested quantity, accepted quantity, unit of measure, value snapshot,
disposition reference, and canonical audit columns.

The initial slice snapshots issued-invoice lines with numeric(18,4) requested
quantities. Duplicate returns are prevented per invoice/context. Inventory and
Finance references are explicit not-connected boundary state. Branch and
financial-year references follow ADR-0025.

## 3. Lifecycle and authorization

The initial lifecycle is `REQUESTED -> INSPECTED -> APPROVED -> PROCESSED ->
CLOSED`, with `INSPECTED -> REJECTED` and `REQUESTED -> CANCELLED`. Processing
does not claim Inventory or Finance side effects.

Candidate permissions: `sales.return.read`, `create`, `update`, `inspect`,
`approve`, `reject`, `process`, `cancel`, and `close`.

## 4. API, frontend, security, and tests

Base path: `/api/v1/sales/returns`; implementable endpoint families are
create/list/detail/draft-update and explicit lifecycle operations. Exact
schemas, errors, pagination/filter fields, numbering, and idempotency are
**BUSINESS DECISION REQUIRED**.

Flutter requires list/create/detail/edit-when-permitted screens, status and
inspection actions, loading/empty/error/pagination/search states, routing,
module guards, and permission-aware controls.

Tests must cover authentication, authorization, source-document linkage,
cross-tenant and cross-organization GET/LIST/PATCH/DELETE, RLS/FORCE RLS,
quantity and duplicate prevention, lifecycle, concurrency, audit, rollback,
and Inventory/Finance failure boundaries.

## 5. Integration boundary

Inventory decides disposition and records stock movement. Finance creates the
financial adjustment. Sales coordinates through published contracts and stores
references/statuses only.

## IMPLEMENTATION STATUS

**IMPLEMENTED — MINIMUM BACKEND POLICY** under ADR-0029. Inventory and Finance
remain explicit not-connected integration boundaries.

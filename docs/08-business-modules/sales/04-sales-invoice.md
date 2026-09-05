# Sales Invoice Management Specification

**Status:** Backend slice and bounded Tax/Finance activation implemented under ADR-0028, ADR-0038, and ADR-0039
**Owner:** Sales
**Dependencies:** Sales Order, Delivery, Finance, Tax, Workflow, Document

## 1. Purpose and scope

Sales owns the invoice business document and billing traceability. Finance owns
receivables, accounting, posting, payment, balances, and credit exposure. Tax
owns authoritative tax calculation. Sales must not write Finance or Tax tables.

## 2. Entities and database design

### Header: `sales_invoices`

Candidate fields: UUIDv7 `id`, tenant/org IDs, mandatory branch and financial
year IDs, `invoice_number`, customer ID, sales order ID, delivery ID, invoice
date, currency, payment terms, due date, tax calculation reference, total
snapshots, status, `version_number`, canonical audit metadata, and approved
reversal/cancellation metadata.

### Detail: `sales_invoice_items`

Candidate fields: UUIDv7 `id`, tenant/org IDs, mandatory branch and financial
year references, `invoice_id`, source order or delivery item reference, line
number, description snapshot, quantity, unit, unit price, discount snapshot,
tax snapshot, line totals, and canonical audit columns.

The initial slice uses numeric(18,4) quantities and prices, numeric(18,4) line
totals, and immutable finalized snapshots. Invoice issuance snapshots the
authoritative Tax result and creates an idempotent Finance posting. The
mandatory branch and financial-year references follow ADR-0025.

## 3. Lifecycle and authorization

The The initial lifecycle is `DRAFT -> ISSUED` or `DRAFT -> CANCELLED`. Issued records are immutable. Finance posting is active through the bounded
Finance contract; payment state and reversal remain outside this slice.

No ordinary PATCH is allowed after issue/finalization. Candidate permissions
requiring approval: `sales.invoice.read`, `create`, `update`, `review`,
`approve`, `issue`, `cancel`, `reverse`, and `close`.

## 4. API, frontend, security, and tests

Base path: `/api/v1/sales/invoices`; create/list/detail/draft-update and
explicit lifecycle operations are required. Exact schemas, response totals,
error mapping, numbering, idempotency, and cross-module status projection are
bounded by ADR-0028. Creation is idempotent by delivery and idempotency key;
numbering is server-generated through `code_counters`.

Flutter requires list/create/detail/edit-draft screens, lifecycle actions,
server-rendered totals/status, loading/empty/error/pagination/filter states,
routing, module enablement, and permissions.

Use tenant-local transactions, RLS/FORCE RLS, immutable issued records,
version conflicts, audit, rollback, and restricted-role PostgreSQL tests.
HTTP tests must cover cross-tenant and cross-organization GET/LIST/PATCH/DELETE
and finalized-document mutation rejection.

## 5. Integration boundary

Tax calculation requests use the Tax contract. Finance posting uses the Finance
contract. Approval and review use
Workflow. Issuance requests Finance posting through the Finance contract.
Documents use Document Management. Sales stores provider references and
authoritative snapshots, not provider-private records.

## IMPLEMENTATION STATUS

**IMPLEMENTED — BOUNDED OPERATIONAL SLICE** — ADR-0028 provides delivery
conversion, immutable line snapshots, lifecycle, numbering, idempotency,
authorization, audit/versioning, RLS/FORCE RLS, Tax snapshots, and Finance
posting. Workflow and Document integrations remain explicit provider-neutral
boundaries.

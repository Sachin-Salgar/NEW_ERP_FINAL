# Sales Invoice Management Specification

**Status:** Authorization package — implementation specification
**Owner:** Sales
**Dependencies:** Sales Order, Delivery, Finance, Tax, Workflow, Document

## 1. Purpose and scope

Sales owns the invoice business document and billing traceability. Finance owns
receivables, accounting, posting, payment, balances, and credit exposure. Tax
owns authoritative tax calculation. Sales must not write Finance or Tax tables.

## 2. Entities and database design

### Header: `sales_invoices`

Candidate fields: UUIDv7 `id`, tenant/org IDs, optional branch and financial
year IDs, `invoice_number`, customer ID, sales order ID, delivery ID, invoice
date, currency, payment terms, due date, tax calculation reference, total
snapshots, status, version, audit metadata, and approved reversal/cancellation
metadata.

### Detail: `sales_invoice_items`

Candidate fields: UUIDv7 `id`, tenant/org IDs, `invoice_id`, source order or
delivery item reference, line number, description snapshot, quantity, unit,
unit price, discount snapshot, tax snapshot, and line totals.

PostgreSQL types, monetary precision, tax component structure, inclusive versus
exclusive representation, exemption/reverse-charge fields, financial-year
relationship, uniqueness, and correction metadata are **BUSINESS DECISION
REQUIRED**. Header/detail tenant/org integrity and immutable finalized snapshots
are mandatory.

## 3. Lifecycle and authorization

The architecture illustrates Draft, Reviewed, Approved, Issued, Partially
Paid, Fully Paid, and Closed. Exact transitions, approval actors, issuance
criteria, cancellation/reversal rules, partial-payment synchronization, and
whether Sales or Finance owns each state are **BUSINESS DECISION REQUIRED**.

No ordinary PATCH is allowed after issue/finalization. Candidate permissions
requiring approval: `sales.invoice.read`, `create`, `update`, `review`,
`approve`, `issue`, `cancel`, `reverse`, and `close`.

## 4. API, frontend, security, and tests

Base path: `/api/v1/sales/invoices`; create/list/detail/draft-update and
explicit lifecycle operations are required. Exact schemas, response totals,
error mapping, numbering, idempotency, and cross-module status projection are
**BUSINESS DECISION REQUIRED**.

Flutter requires list/create/detail/edit-draft screens, lifecycle actions,
server-rendered totals/status, loading/empty/error/pagination/filter states,
routing, module enablement, and permissions.

Use tenant-local transactions, RLS/FORCE RLS, immutable issued records,
version conflicts, audit, rollback, and restricted-role PostgreSQL tests.
HTTP tests must cover cross-tenant and cross-organization GET/LIST/PATCH/DELETE
and finalized-document mutation rejection.

## 5. Integration boundary

Tax calculation requests use the Tax contract. Approval and review use
Workflow. Issuance requests Finance posting through the Finance contract.
Documents use Document Management. Sales stores provider references and
authoritative snapshots, not provider-private records.

## IMPLEMENTATION STATUS

**DEPENDENCY CONTRACT REQUIRED** and **BUSINESS DECISION REQUIRED**.

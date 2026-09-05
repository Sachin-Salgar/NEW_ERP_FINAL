# Sales Credit Note Specification

**Status:** Backend slice implemented under ADR-0030; Finance/Tax providers not connected
**Owner:** Sales/Finance boundary
**Dependencies:** Sales Return, Sales Invoice, Finance, Tax, Workflow, Document

## 1. Purpose and scope

Credit Notes represent an approved commercial adjustment linked to an invoice
or return. Sales owns the originating business reference; Finance owns the
financial posting and customer balance.

## 2. Entities and database design

Candidate header `sales_credit_notes`: UUIDv7 ID, tenant/org IDs, mandatory
branch/financial-year IDs, credit-note number, customer ID, invoice ID,
return ID, date, currency, reason, tax reference, totals, status,
`version_number`, and canonical audit metadata.

Candidate detail `sales_credit_note_items`: UUIDv7 ID, tenant/org IDs, mandatory
branch and financial-year references, credit-note ID, source invoice/return item
reference, line number, quantity, unit, amount, discount/tax snapshots, and
canonical audit columns.

The initial slice uses numeric(18,4) quantities and prices, one note per
processed return/context, server-generated numbering, and immutable issued
records. Finance and Tax status is explicitly `NOT_CONNECTED`.

## 3. Lifecycle and authorization

The initial lifecycle is `DRAFT -> ISSUED` or `DRAFT -> CANCELLED`. Finance
posting, payment balances, reversal, and tax calculation remain outside this
slice.

Candidate permissions requiring approval: `sales.credit_note.read`, `create`,
`update`, `approve`, `issue`, `cancel`, `reverse`, and `close`.

## 4. API, frontend, security, and tests

Base path: `/api/v1/sales/credit-notes`; create/list/detail/draft-update and
explicit lifecycle endpoints are required after decisions. Exact schemas,
errors, pagination, filters, idempotency, and response ownership are
**BUSINESS DECISION REQUIRED**.

Flutter requires list/create/detail/edit-draft screens, lifecycle controls,
server-authoritative totals/status, loading/empty/error/pagination/filter
states, routing, module enablement, and permission-aware actions.

Tests must cover source linkage, tenant/org isolation at HTTP and RLS levels,
immutable finalized documents, duplicate/over-credit prevention, concurrency,
audit, rollback, and Finance/Tax/Workflow/Document failures.

## 5. Integration boundary

Finance owns posting and balances; Tax owns tax; Workflow owns approval;
Document Management owns document storage. No direct private-table access is
allowed.

**IMPLEMENTED — MINIMUM BACKEND POLICY** under ADR-0030. Finance, Tax,
Workflow, and Document remain explicit not-connected integration boundaries.

## IMPLEMENTATION STATUS

**DEPENDENCY CONTRACT REQUIRED** and **BUSINESS DECISION REQUIRED**.

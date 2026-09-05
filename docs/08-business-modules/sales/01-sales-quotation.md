# Sales Quotation Management

**Status:** Current-phase implementation specification  
**Scope:** First Sales vertical slice only

## Scope and dependencies

This slice implements quotation management on the existing modular-monolith
architecture. It depends on Core Enterprise authentication/session, tenant and
organization context, RBAC, Sales module enablement, the CRM Customer entity,
the existing transaction/UoW, PostgreSQL RLS/FORCE RLS, audit, API, pagination,
error, and Flutter routing infrastructure.

Sales quotations reference `customers`; this slice does not create a duplicate
customer model or table.

## Data model

### Current implemented schema

The current implementation is tenant-owned and organization-owned with:

`id`, `tenant_id`, `organization_id`, `quotation_number`, `customer_id`,
`quotation_date`, `valid_until`, `status`, `notes`, `created_at`, `created_by`,
`updated_at`, `updated_by`, `deleted_at`, `deleted_by`, `is_deleted`, and
canonical `version_number`.

`sales_quotation_items` contains:

`id`, `tenant_id`, `organization_id`, `quotation_id`, `line_number`,
`description`, `quantity`, `unit_price`, `unit_of_measure`, `created_at`,
`created_by`, `updated_at`, `updated_by`, and `version_number`.

The current implementation has tenant-safe and organization-safe foreign keys,
soft delete, canonical `version_number` concurrency, deterministic indexes, RLS, and
FORCE RLS. A quotation number is generated server-side and is unique within the
tenant/organization scope. Item line numbers are unique per quotation. A
quotation requires at least one item; quantities are positive, unit prices are
non-negative, and dates satisfy `valid_until >= quotation_date`.

### Authoritative target and remediation gate

The organizational-isolation standard requires every transactional Sales record
to reference `tenant_id`, `organization_id`, `branch_id`, and
`financial_year_id`. The audit and concurrency standards require
`created_at`, `created_by`, `updated_at`, `updated_by`, and
`version_number`. No approved exception for Sales Quotation exists in the
governing documentation or ADRs.

Accordingly, the current quotation implementation is **non-conformant with the
authoritative target architecture**. It lacks `branch_id` and
`financial_year_id`. The canonical audit and concurrency fields are now represented in the
implementation, with migration and validation completed in this remediation
milestone.

Required future implementation remediation, subject to an authorized
implementation task, is to add and validate the mandatory branch and
financial-year references and update the repository, service, API, migrations,
RLS/authorization checks, frontend context, and tests consistently. The exact
business semantics for branch and financial year remain **BUSINESS DECISION
REQUIRED**; this specification does not invent them.
Until that remediation and its validation are complete, the quotation slice is
not fully architecturally compliant.

## Lifecycle

Statuses are `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`, and `CANCELLED`.
Creation starts at `DRAFT`. Allowed transitions are:

- `DRAFT -> SENT | CANCELLED`
- `SENT -> ACCEPTED | REJECTED | EXPIRED | CANCELLED`

Terminal statuses cannot transition. Only drafts may be edited or soft-deleted.
PATCH never accepts arbitrary status changes.

## Permissions and module

The module identifier is `sales`. Permissions are:

`sales.quotation.read`, `sales.quotation.create`, `sales.quotation.update`,
`sales.quotation.delete`, `sales.quotation.send`, `sales.quotation.accept`,
`sales.quotation.reject`, `sales.quotation.expire`, and
`sales.quotation.cancel`.

Every API and route requires authentication, Sales module enablement, and the
relevant permission. Backend authorization is authoritative.

## API

Under `/api/v1/sales/quotations`:

- `POST` create
- `GET` list (existing pagination, deterministic ordering, optional search by
  quotation number/customer/status)
- `GET /:id` detail
- `PATCH /:id` draft data and item update
- `DELETE /:id` draft soft delete
- `POST /:id/send`, `/accept`, `/reject`, `/expire`, and `/cancel`

Tenant identity always comes from authenticated context. Organization and
customer references must belong to that tenant and active organization.

## Audit and validation

Creation, update, deletion, and every lifecycle transition use the existing
audit infrastructure and transaction boundary. Tests must cover lifecycle,
validation, authorization, module enablement, tenant/org isolation, customer
relationships, item constraints, RLS/FORCE RLS, and rollback behavior using
the existing restricted integration role.

## Frontend

Flutter provides Sales navigation plus quotation list, create, details, edit,
and permission-aware lifecycle actions with loading, empty, error, pagination,
search, and status states. Router 2.0 metadata and guards enforce Sales module
and permissions. The frontend does not implement business authorization or
state-transition rules.

## Explicitly deferred

Sales orders, deliveries, inventory/product integration, pricing/discount
engines, tax, finance/accounting, invoices, payments, credit controls,
commissions, approvals, documents/PDF, email or messaging, reporting,
dashboards, revisions, configurable numbering, multi-currency, and advanced
templates are outside this slice.

## IMPLEMENTATION STATUS

**PARTIAL — CANONICAL AUDIT/CONCURRENCY REMEDIATION COMPLETE; ORGANIZATIONAL
CONTEXT REMEDIATION BLOCKED** — the quotation slice satisfies the canonical
audit and optimistic-concurrency requirements and has migration, unit, API, RLS,
typecheck, lint, build, and recovery validation evidence. It still lacks
`branch_id` and `financial_year_id`; their selection and authorization
semantics remain **BUSINESS DECISION REQUIRED**. The remaining Sales
capabilities are specified separately and are not authorized by this document.

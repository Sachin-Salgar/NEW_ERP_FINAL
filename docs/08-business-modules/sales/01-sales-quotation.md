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

`id`, `tenant_id`, `organization_id`, `branch_id`, `financial_year_id`,
`quotation_number`, `customer_id`,
`quotation_date`, `valid_until`, `status`, `notes`, `created_at`, `created_by`,
`updated_at`, `updated_by`, `deleted_at`, `deleted_by`, `is_deleted`, and
canonical `version_number`.

`sales_quotation_items` contains:

`id`, `tenant_id`, `organization_id`, `branch_id`, `financial_year_id`,
`quotation_id`, `line_number`,
`description`, `quantity`, `unit_price`, `unit_of_measure`, `created_at`,
`created_by`, `updated_at`, `updated_by`, and `version_number`.

The current implementation has tenant-safe and organization-safe foreign keys,
soft delete, canonical `version_number` concurrency, deterministic indexes, RLS, and
FORCE RLS. A quotation number is generated server-side and is unique within the
tenant/organization scope. Item line numbers are unique per quotation. A
quotation requires at least one item; quantities are positive, unit prices are
non-negative, and dates satisfy `valid_until >= quotation_date`.

### Organizational transaction context

The organizational-isolation standard requires every transactional Sales record
to reference `tenant_id`, `organization_id`, `branch_id`, and
`financial_year_id`. The audit and concurrency standards require
`created_at`, `created_by`, `updated_at`, `updated_by`, and
`version_number`. No approved exception for Sales Quotation exists in the
governing documentation or ADRs.

The session-scoped policy in ADR-0025 supplies the authorized branch and
financial-year context. New quotations require both values and store them
immutably; list, read, update, and lifecycle operations are scoped to the
authenticated session context. Existing rows are backfilled only from
authoritative organization defaults. Rows without such evidence are preserved
as nullable legacy data and require explicit reclassification before they can
participate in new-context operations.

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

**PARTIAL — QUOTATION CONTEXT IMPLEMENTED** — the quotation slice satisfies the
canonical audit, optimistic-concurrency, tenant/organization/branch/financial-
year context, migration, unit, API, RLS, typecheck, lint, build, and recovery
validation requirements. Legacy rows without authoritative context remain a
documented data-remediation residual. The remaining Sales capabilities are
specified separately and are not authorized by this document.

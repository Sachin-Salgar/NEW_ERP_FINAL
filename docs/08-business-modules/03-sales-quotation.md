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

`sales_quotations` is tenant-owned and organization-owned with:

`id`, `tenant_id`, `organization_id`, `quotation_number`, `customer_id`,
`quotation_date`, `valid_until`, `status`, `notes`, `created_at`, `created_by`,
`updated_at`, `updated_by`, `deleted_at`, `deleted_by`, `is_deleted`, and
`version`.

`sales_quotation_items` contains:

`id`, `tenant_id`, `organization_id`, `quotation_id`, `line_number`,
`description`, `quantity`, `unit_price`, `unit_of_measure`, `created_at`, and
`updated_at`.

UUIDs, tenant-safe and organization-safe foreign keys, soft delete, optimistic
versioning, deterministic indexes, RLS, and FORCE RLS follow the existing
database architecture. A quotation number is generated server-side and is
unique within the tenant/organization scope. Item line numbers are unique per
quotation. A quotation requires at least one item; quantities are positive,
unit prices are non-negative, and dates satisfy `valid_until >= quotation_date`.

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


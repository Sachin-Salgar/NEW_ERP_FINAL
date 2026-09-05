# Sales Integration Contracts

**Status:** IMPLEMENTED — PROVIDER-NEUTRAL BOUNDARIES
**Owner:** Sales plus owning platform/business modules

## Contract rules

All contracts are provider-neutral application ports or approved domain events.
No Sales implementation may query or mutate another module's private tables.
Every request carries authenticated tenant context, authorized organization
context, actor/session identity where applicable, correlation ID, source
document ID/version, and an idempotency key for retriable mutations.

| Boundary | Sales responsibility | Owning module responsibility | Required contract/output | Status |
|---|---|---|---|---|
| CRM/Customer | validate/reference customer and permitted contact context | customer master and relationship ownership | tenant/org-safe customer lookup and status | Existing Customer contract must be published |
| Inventory | request availability/reservation/fulfillment/disposition | item master, stock, warehouse, movement, reservation | typed reservation, delivery, return, failure, and idempotency results | Item/warehouse references and order reservation activation implemented under ADR-0034/0035; delivery/return effects remain gated |
| Finance | submit invoice/credit-note accounting consequence | posting, AR, receipts, balances, credit | accepted/rejected posting reference and status | Contract required |
| Tax | submit taxable lines/context | tax rules, exemptions, components, calculation authority | immutable tax result/version and failure reason | Contract required |
| Workflow | start/query/apply approved workflow decisions | definitions, tasks, approvals, escalation, audit | versioned decision/task contract | Contract required |
| Notification | emit durable business event | delivery channel/provider and retry | outbox/event contract with idempotency | Existing notification port is platform-scoped; Sales event contract required |
| Document Management | request/reference generated documents | storage, metadata, access, retention | document reference and generation status | Contract required |
| Reporting | publish approved read model/query inputs | reporting ownership and aggregation | read-only query/report contract | Contract required |

## Shared failure and transaction rules

Synchronous provider failures must return explicit domain/API errors and must
not leave a partial Sales mutation. Asynchronous operations require durable
outbox/job semantics, idempotency, correlation, replay handling, and
reconciliation states. Exact sync/async choice is **BUSINESS DECISION REQUIRED**
per contract.

Provider callbacks/events must be authenticated, tenant-bound, organization
validated, version-checked, idempotent, and audited. Sales must never trust
client-supplied tenant IDs or provider references without ownership validation.

## Explicit prohibitions

Sales must not write Inventory, Finance, Tax, Workflow, Notification, Document,
or Reporting private tables; duplicate their business rules; or claim provider
success without a contract response.

Typed provider-neutral ports are defined for Customer, Inventory, Finance, Tax,
Workflow, Notifications, and Documents. Provider implementations remain
**PENDING DEPENDENCY** and Sales does not claim downstream side effects.

## IMPLEMENTATION STATUS

The bounded Inventory provider is implemented with authenticated, organization-
scoped APIs and typed application operations for receipt, reservation, release,
fulfillment, and return. Sales remains prohibited from direct Inventory SQL.
New quotation lines may persist an Item Master reference, new order conversion
requires Item Master identity and an active warehouse, and Sales invokes the
typed Inventory reservation port. Historical rows remain nullable and are not
backfilled. Delivery fulfillment and Sales Return stock effects remain gated
until their source-reference orchestration is implemented.

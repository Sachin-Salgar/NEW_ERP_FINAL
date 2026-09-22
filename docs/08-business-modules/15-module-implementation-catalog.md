# ERP Module Implementation & Documentation Catalog

**Status:** Current repository implementation/documentation baseline  
**Branch audited:** feat/complete-hr-module-2026-09-21  
**Commit audited:** feaa8c5e6b4573fb0846561b472892c2fd623390

## Purpose

This catalog keeps business-module architecture, documented feature scope, implementation state, API/runtime entry points, and architectural decisions aligned.

It deliberately separates:

- **Implemented** — current backend/domain/API implementation exists, with frontend/tests where applicable.
- **Bounded / Partial** — a working slice exists, but the architecture describes a broader target.
- **Architecture-only** — documented target capability with no equivalent current application-service/route implementation identified in this audit.
- **Platform capability** — shared functionality used by modules.

A feature appearing in an architecture document is not treated as proof that it is implemented.

## Current Module Matrix

| Module | Documented feature scope | Current state | Primary evidence |
|---|---|---|---|
| Core Enterprise | Tenant, Branch, Identity, Users, Roles, Permissions, Membership, context | Implemented | platform/authentication/authorization services, tenant/branch/RBAC routes, migrations and integration tests |
| Sales | Quotation, Order, Delivery, Invoice, Return, Credit Note, Pricing, Discount, Reporting | Implemented bounded slices | quotation, order, delivery, invoice, sales-return, credit-note, pricing, discount and sales-reporting services |
| Procurement | Supplier, Requisition, Purchase Order, Receipt; broader RFQ/vendor invoice/return/analytics architecture | Bounded implementation | procurement service/routes/repositories/migrations |
| Inventory | Warehouse, stock, reservations, fulfillment/return, item master | Implemented bounded operational slice | inventory-service and item-master-service plus routes/repositories/migrations |
| Manufacturing | Machine/capability, process/routing, work order, task sheet, material requisition/issue, readiness, production, quality output, return, variance | Implemented execution slice | manufacturing-machine-service and manufacturing-execution-service plus routes/repositories/migrations |
| Finance | Accounting, receivables/payables, posting, financial controls | Architecture-defined; no full Finance application-service surface identified in this audit | Finance architecture + bounded integration contracts/ADRs |
| HR | Employee, organization, ERP access, recruitment, attendance, leave, payroll, statutory configuration, ESS, performance, training, compliance/ER, reporting | Implemented | hr-service, identity-provisioning-service, HR routes/repositories/migrations/frontend |
| CRM | CRM/customer relationship and customer-facing sales support | Architecture-only in current backend service surface | CRM architecture |
| Quality Management | Specifications, inspections, sampling, NCR, CAPA, audits, supplier/customer quality, analytics | Architecture-only in current backend service surface | Quality architecture |
| Asset Maintenance | Asset registry, hierarchy, lifecycle, warranty/contracts, condition, maintenance, spares, resources, cost/KPIs | Architecture-only in current backend service surface | Asset Maintenance architecture |
| BI & Analytics | Reporting, dashboards, KPIs, analytical storage, self-service, forecasting, enterprise reporting, AI-assisted analytics | Architecture-only; operational reporting foundations exist elsewhere | BI architecture + module reporting services |
| Workflow/BPM | Canonical workflow definitions, versions, instances, tasks, decisions, delegation/escalation foundations | Implemented foundation; bounded integration | workflow-service, workflow routes/repository/migration, ADR-0043 |

## Core Enterprise / Identity and Access

Core Enterprise owns the platform security and tenant boundary:

- Tenant lifecycle and tenant isolation.
- Branch lifecycle and branch working context.
- Identity and credentials.
- Tenant membership.
- ERP User records.
- Roles and permissions.
- User-role assignment.
- Branch access.
- Unified login and membership/context resolution.
- Session lifecycle.
- Authorization and module entitlements.
- Audit/security administration.

The authentication boundary is:

login identifier -> identity -> credential -> tenant membership -> ERP user -> roles/permissions/branch access

HR Employee is not the definition of an ERP User.

The current relationship is:

Employee -> optional identity_id -> Identity
Employee -> optional user_id -> ERP User

Therefore an ERP user can exist without being an HR employee. HR provisioning is a specialized employee-to-access operation and must not become a second identity system.

Canonical platform behavior covers account registration, password recovery, email verification, MFA/TOTP, refresh-token rotation, sessions, tenant membership, roles/permissions, branch access, access suspension/revocation/restoration, and audit logging.

## Sales

### Implemented working features

- Quotation: create, read/list, update, delete, lifecycle transition.
- Sales Order: create, read/list, update, delete, lifecycle transition, inventory reservation.
- Delivery: create, read/list, update, lifecycle transition.
- Invoice: create, read/list, update, lifecycle transition.
- Sales Return: create, read/list, update, inspect/approve/reject/process/close/cancel lifecycle; processed returns call Inventory using an idempotent stock-return contract.
- Credit Note: create, read/list, update, lifecycle transition.
- Pricing: create/list/get/update, item association, price resolution, lifecycle.
- Discount: create/list/get/update, discount resolution, lifecycle.
- Reporting: sales document summary reporting.
- Backend authorization, tenant/branch/financial-year context, optimistic version checks, audit, and transaction boundaries are enforced by the relevant services.

The Sales architecture correctly distinguishes broad target architecture from bounded implementation specifications. The quotation specification explicitly calls out architectural remediation before full compliance.

## Procurement

### Implemented working features

- Supplier create/list/get/update/delete.
- Purchase requisition create/list/get/update.
- Requisition submit/cancel/transition.
- Purchase Order create/list/get/update.
- Purchase Order submit/cancel/transition.
- Purchase receipt create/list/get/update.
- Receipt creation supports operation-key/idempotency semantics.
- Inventory is consumed through an explicit dependency contract.
- Purchase Order submission invokes the canonical Workflow/BPM service.
- Workflow completion transitions the Procurement-owned Purchase Order; Workflow does not own Procurement persistence.

Broader RFQ, supplier quotations, vendor invoices, vendor returns, three-way matching, procurement analytics, and vendor performance remain architecture capabilities unless separately implemented.

## Inventory

### Implemented working features

- Warehouse create/list/update.
- Stock listing.
- Stock receipt.
- Stock reservation.
- Reservation lookup by source.
- Reservation fulfillment by source.
- Reservation release.
- Reservation fulfillment.
- Stock return.
- Item Master through the separate Item Master service.
- Sales, Procurement, and Manufacturing consume Inventory through explicit application/domain contracts rather than direct persistence access.

Broader batch/serial traceability, valuation/costing, physical inventory/cycle counting, and advanced warehouse functions remain subject to their implementation state.

## Manufacturing

### Implemented working features

- Machine master.
- Tool master.
- Fixture master.
- Calibration records for machine/tool/fixture.
- Machine capability matrix.
- Product/process detail.
- Routing operations.
- Work order creation/listing.
- Work-order scheduling.
- Task-sheet status updates.
- Material requisition.
- Material issue.
- Machine/tool/fixture readiness gate.
- Production output punching with GOOD/REWORK/REJECT/RETURN outcomes.
- Quality output punching.
- Material return.
- Production variance records.
- Module enablement and fine-grained manufacturing permissions.
- Tenant/branch/financial-year authorization, audit, transactions, and optimistic/concurrency controls.

Manufacturing scheduling invokes the canonical Workflow/BPM service with document type manufacturing_work_order. This is currently a workflow gate. The completion callback path must be verified before claiming a complete end-to-end Manufacturing approval integration.

## HR

### Implemented working features

- Organization hierarchy: business units, divisions, departments, sections, teams, positions.
- Employee master and employment history.
- Employee skills and documents.
- Onboarding and exit lifecycle.
- Employee relations.
- Explicit Employee -> Identity -> ERP User access linkage.
- ERP access suspend/revoke/restore.
- Invitation/password lifecycle through canonical account-security services.
- Attendance punches, records, corrections, import/evaluation, finalization.
- Shifts, assignments, holidays.
- Leave types, policies, balances, ledger, requests, approval/cancellation/calendar processing.
- Payroll structures/components, employee salary, periods, runs, payslips, adjustments, loans, reimbursements.
- Payroll validation, calculation, close and reversal.
- Versioned statutory configuration.
- Recruitment requisitions/openings/candidates/applications/interviews/offers and accepted-offer onboarding.
- Performance management.
- Learning/training.
- Compliance.
- ESS.
- Workforce/reporting summaries.

Employee creation does not create ERP login automatically. Canonical platform access remains independent of HR employment.

HR does not contain a local approval engine. Approval-bearing HR processes use the canonical Workflow/BPM boundary.

## Finance

Finance remains authoritative for accounting persistence and financial posting semantics. HR, Sales, Procurement, Inventory, and other modules must not write Finance private tables directly.

Current repository evidence supports Finance as an architectural authority and integration boundary, but this audit did not identify a full Finance application-service/route implementation comparable to Sales, Procurement, Inventory, Manufacturing, or HR.

Finance documentation must therefore distinguish architecture, bounded integration contracts, and full module implementation.

## CRM, Quality, Asset Maintenance and BI

These architecture documents contain substantial target feature definitions. Their feature lists are authoritative target specifications, but current implementation must be demonstrated by corresponding service/API/frontend/test evidence.

### CRM target features

Customer relationship management, customer-facing sales support, opportunities/interactions and related CRM processes.

### Quality target features

- Quality specifications.
- Inspection planning/execution.
- Sampling plans.
- Acceptance quality control.
- Non-conformance.
- CAPA.
- Quality audits.
- Supplier/customer quality.
- Quality analytics.

### Asset Maintenance target features

- Asset registry/master.
- Asset hierarchy/location.
- Lifecycle.
- Warranty/service contracts.
- Condition monitoring.
- Maintenance planning/scheduling.
- Preventive/predictive/corrective/breakdown/emergency maintenance.
- Work orders.
- Spare-parts coordination.
- Resources/contractors.
- Maintenance cost/KPIs.

### BI & Analytics target features

- Operational/management reporting.
- Executive dashboards.
- KPI/scorecard management.
- Analytical storage.
- Self-service analytics.
- Enterprise reporting/distribution.
- Forecasting/predictive analytics.
- Enterprise search/knowledge discovery.
- AI-assisted analytics.

These capabilities must not be represented as current implementations until their code/API/frontend/test evidence exists.

## Workflow/BPM

### Current implementation

The repository contains one canonical WorkflowService and Workflow repository/contracts. Modules invoke it through application contracts.

The current foundation includes:

- Workflow definitions.
- Validation.
- Activation/version lifecycle.
- Tenant + branch scoping.
- Workflow instances.
- Approval tasks.
- Role-based approval assignment.
- Required approval counts in the current sequential-level model.
- Approve/reject/correction decisions.
- Requester self-approval prevention.
- Audit records.
- Idempotency/concurrency handling.
- Delegation persistence/API foundation.
- Escalation trigger/scheduling foundation.
- Notification integration hooks.
- Module callback/handler mechanism.

### Current bounded integration

Purchase Order is the authoritative end-to-end integration documented by ADR-0043.

Workflow must not directly mutate Procurement private tables. Procurement owns Purchase Order state; Workflow owns workflow state.

Manufacturing currently invokes the engine as a scheduling approval gate. This is narrower than a fully registered module callback and must be documented as such until the completion transition is verified end-to-end.

## Cross-module rules

1. One canonical Workflow/BPM engine; modules do not create local approval engines.
2. The module owns business state; Workflow owns process/approval state.
3. Identity/User is independent of HR Employee.
4. Tenant is the security/data-isolation boundary.
5. Branch is a tenant-scoped authorization/working-context dimension, not a second tenant.
6. Frontend is never the security boundary.
7. Cross-module private tables are not directly accessed.
8. Finance owns accounting persistence and posting semantics.
9. Inventory owns stock state.
10. HR owns employee/HR state.
11. Configuration and statutory rules are data/configuration where the architecture requires it.
12. Historical business state remains auditable and deterministic.
13. Business rules remain in backend services, not frontend code.
14. Every implementation claim must be supported by code/API/test evidence.

## Documentation maintenance rule

For every implemented feature, the owning module documentation should record:

- business purpose;
- actor/permission requirements;
- lifecycle/status transitions;
- validation/invariants;
- data ownership;
- API/application contract;
- cross-module dependencies;
- transaction/idempotency/concurrency behavior;
- audit behavior;
- workflow behavior where applicable;
- frontend entry point where implemented;
- tests/evidence;
- known limitations and future extensions.

For every target feature that is not implemented, documentation must say Architecture/Target or Planned rather than implying current availability.

This catalog is the cross-module index; detailed business rules remain in the owning module specification.

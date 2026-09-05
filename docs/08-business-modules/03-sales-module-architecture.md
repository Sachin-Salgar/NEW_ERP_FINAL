# Sales Module Architecture

**Status:** Current business-module architecture
**Scope:** Customer sales lifecycle from quotation through returns and credit notes

## Purpose

The Sales Module manages the customer sales lifecycle and integrates with the CRM, Inventory, Finance, Tax, Workflow, Notification, Document, and Reporting capabilities through approved module contracts.

The module is a logical module within the current modular monolith and is not an independently deployed service.

## 1. Sales Overview

The Sales Module covers:
- Quotations.
- Sales Orders.
- Deliveries and shipment handling.
- Sales invoices.
- Customer returns.
- Credit notes.
- Pricing and discounts.
- Sales reporting and analytics.

Receipts and accounting entries remain responsibilities of the Finance capability.

## 2. Sales Lifecycle

An illustrative lifecycle is:

```text
Opportunity
   ↓
Quotation
   ↓
Sales Order
   ↓
Delivery
   ↓
Invoice
   ↓
Payment
   ↓
Order Closed
```

Actual stages and approvals are configurable business behavior and must follow the implemented workflow contracts.

## 3. Quotation Management - Target Architecture

The following quotation description is part of the target Sales architecture.
The currently approved and implemented quotation slice is narrower and is
governed by [Sales Quotation Management](./sales/01-sales-quotation.md).
Statements in this target architecture do not authorize implementation beyond
that specification.

Quotations represent formal offers containing customer, product/service, pricing, tax, discount, validity, payment, and delivery information.

The quotation capability supports:
- Draft/review/submission and negotiation states.
- Customer and product pricing.
- Contract/promotional/volume pricing where configured.
- Authorized discounts.
- Approval workflows based on configured business criteria.
- Conversion to a Sales Order where appropriate.
- Quotation history and reporting.

Pricing and tax calculations must use the authoritative pricing/tax capabilities rather than duplicating business calculations in the UI.

## 4. Sales Order Management

Sales Orders record customer commitments following quotation acceptance or direct order entry.

The capability supports:
- Customer and order information.
- Branch/warehouse context.
- Item quantities and pricing.
- Delivery scheduling.
- Payment terms.
- Inventory reservation through the Inventory contract.
- Partial delivery and order amendment handling.
- Approval and closure workflows.

Order amendments and cancellation require the authorization and workflow rules applicable to the order's current state.

## 5. Delivery & Shipment Management

Delivery management coordinates fulfillment with warehouse/inventory operations and may integrate with logistics providers where such integration is implemented.

Typical stages include:

```text
Sales Order
   ↓
Picking
   ↓
Packing
   ↓
Dispatch
   ↓
In Transit
   ↓
Delivered
   ↓
Completed
```

The exact lifecycle is configurable according to implemented business rules.

Delivery records may include order references, customer/branch/warehouse context, dates, shipping method, carrier/tracking information, delivered quantities, and delivery status.

## 6. Sales Invoice Management

Sales invoices record the financial billing consequence of sales transactions.

The capability supports:
- Invoice generation and lifecycle management.
- Customer, order, and delivery references.
- Currency, pricing, discount, and tax information.
- Payment terms and due dates.
- Integration with the Finance capability.
- Document and audit traceability.

Tax calculation must use the authoritative tax capability where one is defined. Financial posting remains governed by the Finance architecture.

## 7. Sales Returns & Credit Notes

Sales Returns handle approved customer returns arising from conditions such as damage, incorrect delivery, defects, warranty, cancellation, or excess quantity.

The capability supports:
- Return requests and inspection.
- Approval.
- Inventory disposition.
- Credit-note processing.
- Replacement/refund workflows where implemented.
- Return history and reporting.

Inventory disposition may include return to stock, quarantine, scrap, repair, or other configured outcomes.

## 8. Cross-Module Integration

Sales may interact with:
- CRM for customer/opportunity context.
- Inventory for availability, reservation, and fulfillment.
- Finance for invoices, receivables, and accounting consequences.
- Tax for applicable tax calculation.
- Workflow for approvals and state transitions.
- Notification for user-facing business events.
- Document Management for sales documents.
- Reporting for authorized analytical views.

Integration must use published contracts or approved business/application events. A conceptual relationship does not by itself justify direct database access or a new messaging infrastructure.

## 9. Data Ownership

Sales owns its sales-domain records and business state. Other modules must not directly modify Sales private persistence structures.

Cross-module data access shall use the owning module's published contract or another explicitly approved mechanism.

## 10. AI Implementation Rules

When implementing a Sales feature, AI must:
1. identify the Sales sub-capability that owns the behavior;
2. read the relevant Sales and dependent-module specifications;
3. preserve the modular-monolith boundary;
4. use published contracts for Inventory, Finance, CRM, Tax, Workflow, and other dependencies;
5. avoid duplicating authoritative pricing, tax, accounting, or authorization rules;
6. stop and ask when a required business rule or contract is unspecified.

## 11. Implementation specification package

This architecture document is conceptual and does not by itself authorize
implementation of every listed capability. The implementation specification
package is indexed in [Business Modules README](./README.md):

- [Sales Quotation](./sales/01-sales-quotation.md) — current implemented slice.
- [Sales Order](./sales/02-sales-order.md)
- [Sales Delivery](./sales/03-sales-delivery.md)
- [Sales Invoice](./sales/04-sales-invoice.md)
- [Sales Return](./sales/05-sales-return.md)
- [Sales Credit Note](./sales/06-sales-credit-note.md)
- [Sales Pricing](./sales/07-sales-pricing.md)
- [Sales Discounts](./sales/08-sales-discount.md)
- [Sales Workflow](./sales/09-sales-workflow.md)
- [Sales Integrations](./sales/10-sales-integrations.md)
- [Sales Reporting](./sales/11-sales-reporting.md)

Each remaining-capability specification explicitly records unresolved business
decisions and dependency-contract requirements. Those gates must be resolved
and approved before source implementation begins.

Specification completeness does not imply implementation authorization.

## Cross References

- [Business Modules Architecture](./01-business-modules-architecture.md)
- [Core Enterprise Modules](./02-core-enterprise-modules.md)
- [Inventory Module](./05-inventory-module-architecture.md)
- [Finance Module](./07-finance-module-architecture.md)
- [CRM Module](./09-crm-module-architecture.md)
- [Workflow/BPM Module](./14-workflow-bpm-module-architecture.md)
- [Backend Authentication & Authorization](../04-backend/07-authentication-and-authorization.md)

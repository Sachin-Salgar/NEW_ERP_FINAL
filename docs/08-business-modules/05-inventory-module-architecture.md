# Inventory Module Architecture

**Document Purpose:** Define the business scope, responsibilities, lifecycle, and integration boundaries of the Inventory module.

## 1. Overview

The Inventory module provides control over inventory quantities, locations, movements, reservations, traceability, valuation, and physical verification across the organization's enabled operational structure.

The module supports multi-warehouse and multi-location operations and integrates with Procurement, Sales, Manufacturing, Finance, Asset Management, Maintenance, Projects, Quality, Workflow, and Reporting where those capabilities are enabled.

## 2. Objectives

The Inventory module aims to:
- Maintain accurate inventory records.
- Provide timely stock visibility.
- Support inventory traceability.
- Improve warehouse operations.
- Control reservations and allocations.
- Support inventory valuation and financial integration.
- Preserve an auditable history of stock movements.

## 3. Scope

The module covers:
- Item and inventory definitions relevant to inventory operations.
- Warehouse and storage-location management.
- Inventory transactions and ledger history.
- Batch and serial-number tracking.
- Inventory valuation and costing.
- Inventory transfers.
- Inventory reservations.
- Physical inventory and cycle counting.
- Inventory adjustments and related audit records.

## 4. Inventory Lifecycle

An illustrative lifecycle is:

```text
Purchase / Production / Return
            ↓
      Goods Receipt
            ↓
      Available Stock
            ↓
        Reservation
            ↓
       Issue / Sale
            ↓
 Consumption / Transfer
            ↓
     Return / Adjustment
```

Actual workflows may vary by business process and enabled module capabilities.

## 5. Module Boundaries

Inventory is authoritative for inventory state and inventory movement records within its defined responsibility.

Other modules remain authoritative for their own business documents. For example:

- Procurement owns procurement transactions.
- Sales owns sales transactions and orders.
- Manufacturing owns production transactions.
- Finance owns accounting and financial posting.
- Asset Management owns asset records.
- Quality owns quality inspections and quality decisions.
- Workflow owns workflow execution where applicable.

Cross-module operations shall use the established application/API and domain-event boundaries rather than direct access to another module's internal implementation.

## 6. Item Master

The Item Master provides standardized item definitions used by inventory and other business modules.

An item may include:
- Item code and name.
- Descriptions.
- Category and classification.
- Brand/manufacturer.
- Units of measure and alternate units.
- Barcode/SKU.
- Applicable HSN/SAC or tax classification where required.
- Default operational attributes.
- Status.
- Organization-specific attributes where supported.

Typical item categories include raw materials, semi-finished goods, finished goods, trading goods, spare parts, consumables, packaging materials, services, fixed assets, and non-inventory items. The actual supported category model shall be defined by the implementation.

Historical transaction references must remain valid when an item becomes inactive or archived.

## 7. Warehouse Management

A warehouse represents a physical or logical inventory-storage location.

A warehouse may contain a configurable hierarchy such as:

```text
Warehouse
   ↓
Zone
   ↓
Aisle
   ↓
Rack
   ↓
Shelf
   ↓
Bin
```

The hierarchy may be simplified or expanded according to operational requirements.

Warehouse operations may include:
- Receiving.
- Put-away.
- Picking.
- Packing.
- Internal transfers.
- Dispatch.
- Returns.
- Cycle counting.

Warehouse capacity information may include storage capacity, volume, weight limits, bin occupancy, and available space where those capabilities are implemented.

## 8. Inventory Transactions

Every inventory movement shall originate from a validated inventory transaction rather than an arbitrary direct stock-balance update.

Transaction sources may include:
- Goods receipt.
- Sales delivery.
- Production.
- Material consumption.
- Inventory transfer.
- Stock adjustment.
- Physical count.
- Sales return.
- Vendor return.
- Asset issue.
- Maintenance issue.
- Other enabled operational processes.

A transaction may contain:
- Transaction number/type.
- Organization and branch context.
- Warehouse and storage location.
- Item.
- Batch/serial reference where applicable.
- Quantity and unit of measure.
- Reference document.
- Transaction date/time.
- User and authorization state where applicable.

After final posting, historical inventory transactions shall not be overwritten. Corrections shall use appropriate reversal or adjustment transactions.

## 9. Inventory Ledger

Inventory transactions shall produce the inventory history required to reconstruct stock movement.

Ledger information may include:
- Previous quantity.
- Transaction quantity.
- Resulting quantity.
- Cost information where applicable.
- Transaction reference.
- Actor.
- Timestamp.

The inventory ledger is authoritative for inventory movement history within the Inventory module.

## 10. Batch and Serial Number Management

The module may support batch and serial tracking independently or together according to item requirements.

Batch information may include:
- Batch number.
- Manufacturing/receipt date.
- Expiry date.
- Supplier/internal lot reference.
- Inspection status.
- Available quantity.

Serial information may include:
- Serial number.
- Item.
- Batch reference where applicable.
- Manufacturing date.
- Warranty information where applicable.
- Current status/location.
- Customer assignment where applicable.

Serial uniqueness shall be enforced according to the applicable organization/tenant scope established by the data model; the exact uniqueness boundary must not be invented by individual features.

The module should support forward and backward traceability, including supplier, production, warehouse, and customer relationships where the corresponding business processes provide the required references.

## 11. Inventory Valuation and Costing

Inventory valuation determines the financial value attributed to inventory according to the organization's applicable accounting configuration and jurisdiction.

Potential valuation/costing approaches identified by the source architecture include:
- FIFO.
- LIFO where legally/accountingly applicable.
- Weighted average cost.
- Standard cost.
- Specific identification.

The supported methods and their accounting treatment must be established by the Finance/accounting architecture and applicable business requirements. This document does not mandate that every method be implemented in every deployment.

Cost components may include purchase price, freight, customs duty, insurance, handling, manufacturing overhead, and other configured landed-cost adjustments.

Inventory revaluation shall be controlled, authorized, and auditable where supported.

Financial postings are the responsibility of the Finance integration boundary; Inventory must not independently implement conflicting accounting rules.

## 12. Inventory Closing

Where inventory-period closing is required, processing may include:
- Cost finalization.
- Inventory reconciliation.
- Financial posting.
- Period locking.
- Audit verification.

The exact accounting calendar and period-control rules are governed by the Finance architecture.

## 12A. Minimum Sales Fulfillment Foundation

ADR-0034 defines the bounded Inventory foundation currently implemented for
Sales integration. Warehouses are organization-owned and explicitly active or
inactive. The first slice persists stock balances keyed by organization,
warehouse, and item with `on_hand`, `reserved`, and derived `available`
quantities. Reservations are all-or-nothing and move available quantity to
reserved quantity without changing on-hand. Release reverses that reservation;
fulfillment consumes reserved and on-hand quantity; returns increase on-hand.

Reservation, fulfillment, receipt, and return operations are transaction-bound,
row-locked, audited, and idempotent by source or operation key. Inventory
exposes provider-neutral contracts and Sales must not access Inventory tables.
Branch and financial-year context is captured for transaction-facing
operations. Advanced warehouse hierarchy, batch/serial tracking, valuation,
replenishment, backorders, partial reservation, and advanced ATP remain
deferred.

## 13. Inventory Transfers

Inventory transfers manage movement between warehouses, branches, storage locations, departments, projects, and organizational entities where permitted.

Transfer types may include:
- Warehouse-to-warehouse.
- Branch-to-branch.
- Bin-to-bin.
- Department/project movements.
- Inter-organization transfers.
- Transit movements.

A transfer may include source/destination context, requested/approved actors, items, transport information, status, and receipt confirmation.

An illustrative workflow is:

```text
Transfer Request
      ↓
Approval where required
      ↓
Picking
      ↓
Dispatch
      ↓
In Transit
      ↓
Receipt Confirmation
      ↓
Inventory Updated
      ↓
Closed
```

In-transit inventory shall remain distinguishable from available destination inventory until receipt is confirmed.

Financial treatment depends on the transfer type and accounting rules. The Inventory module shall integrate with Finance rather than inventing accounting behavior.

## 14. Inventory Reservation

Reservations allocate inventory for a future business operation without necessarily removing the inventory physically.

Reservation sources may include:
- Sales orders.
- Manufacturing orders.
- Service orders.
- Projects.
- Internal requests.
- Maintenance activities.

A reservation may contain item, quantity, location, source document, reservation date, expiry, actor, and status.

Illustrative lifecycle:

```text
Available Inventory
       ↓
Reserved
       ↓
Allocated / Issued
       ↓
Completed
```

Reservations may support configurable rules such as automatic/manual reservation, partial reservation, priority, expiry, and controlled override.

Availability calculations should distinguish, where applicable:
- Physical stock.
- Reserved stock.
- Available stock.
- In-transit stock.
- Inspection stock.
- Quarantine stock.

## 15. Physical Inventory and Cycle Counting

Physical inventory verification compares recorded quantities with physical inventory.

Supported approaches may include:
- Full physical count.
- Cycle counting.
- Blind counting.
- Sample counting.
- Location-based counting.
- ABC-based counting.

An illustrative workflow is:

```text
Count Scheduled
      ↓
Inventory Freeze if required
      ↓
Physical Count
      ↓
Variance Analysis
      ↓
Approval where required
      ↓
Inventory Adjustment
      ↓
Completed
```

Whether inventory remains operational during a count is an organizational/process decision.

Variances may result from counting errors, damage, theft, data-entry errors, receiving/shipping errors, manufacturing variances, or other operational causes.

Approved variances shall create appropriate inventory adjustment and audit records. Historical inventory transactions must not be overwritten.

## 16. Reporting

Typical inventory reporting may include:
- Inventory summary.
- Stock ledger.
- Inventory aging.
- Inventory valuation.
- Stock movement.
- Warehouse utilization.
- Batch and serial history.
- Transfer register.
- Reservation status.
- Physical-count variance.
- Inventory accuracy and shrinkage analysis.

Reports must respect organization/tenant and authorization boundaries.

## 17. Integration Principles

Inventory integrations shall preserve module ownership and transactional integrity.

Examples:

```text
Procurement → Receipt → Inventory
Sales       → Delivery → Inventory
Manufacturing → Production/Consumption → Inventory
Inventory   → Valuation/Posting → Finance
Quality     → Inspection Status → Inventory
Maintenance/Projects/Assets → Issue/Return → Inventory
```

The exact integration mechanism shall follow the backend architecture, application service boundaries, and approved event/API contracts.

## 18. Audit and Security

Inventory operations shall respect:
- Authentication and authorization boundaries.
- Organization/tenant isolation.
- Role/permission controls.
- Immutable historical transaction requirements.
- Audit logging for sensitive changes.

Frontend controls are usability features only; backend authorization remains authoritative.

## 19. Implementation Guidance for AI-Assisted Development

When implementing Inventory features, the AI must:

1. Treat this document as the Inventory module's architectural boundary.
2. Reuse existing repository patterns before introducing new abstractions.
3. Preserve transaction and ledger integrity.
4. Never directly modify historical inventory transactions to correct business state.
5. Keep Finance, Procurement, Sales, Manufacturing, Quality, Asset, and Workflow responsibilities within their established boundaries.
6. Never invent unsupported valuation, reservation, transfer, or accounting rules.
7. Verify existing contracts and module implementations before changing integration behavior.
8. Stop and ask when the business requirement conflicts with this architecture or is materially ambiguous.

## Cross References

- [Business Modules Architecture](./01-business-modules-architecture.md)
- [Core Enterprise Modules](./02-core-enterprise-modules.md)
- [Procurement Module](./04-procurement-module-architecture.md)
- [Sales Module](./03-sales-module-architecture.md)
- [Manufacturing Module](./06-manufacturing-module-architecture.md)
- [Finance Module](./07-finance-module-architecture.md)
- [Quality Management Module](./11-quality-management-module-architecture.md)
- [Backend API Design](../04-backend/06-api-design-standards.md)
- [Backend Transactions and Repositories](../04-backend/09-repository-pattern.md)
- [Security Architecture](../06-security/04-enterprise-security-architecture.md)

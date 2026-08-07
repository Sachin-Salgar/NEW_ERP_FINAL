# Architectural Boundaries & Communication

**Document Purpose**: Define module boundaries, communication patterns, and rules for inter-module integration.

**Audience**: Architects, module leads, integration teams

---

## Introduction

Modules in the ERP platform must remain independent while working together as an integrated system. This document defines:

- How modules establish boundaries
- How modules communicate
- What dependencies are allowed
- How to maintain independence while supporting integration

---

## Module Boundaries

### Published Interfaces

Each module has published interfaces that other modules can depend on:

**What modules can know**:
- Published REST APIs (/api/{module}/...)
- Published data models (schemas, DTOs)
- Published domain events (if event-driven)
- Documented service contracts
- Versioned API specifications

**What modules cannot depend on**:
- Internal implementation details
- Private methods or services
- Internal database tables directly
- Undocumented APIs
- Framework internals

### Boundary Enforcement

Module boundaries are enforced through:

1. **Database**: No cross-module database access (except through published APIs)
2. **Imports**: Backend code dependency checks prevent unauthorized imports
3. **API**: Communication only through published REST APIs
4. **Contracts**: Data contracts prevent tight coupling

### Example Module Boundary

```
Sales Module
├── Public API
│   ├── /api/sales/orders
│   ├── /api/sales/customers
│   └── /api/sales/invoices
├── Domain Events (Published)
│   ├── SalesOrderCreated
│   ├── SalesOrderApproved
│   └── InvoicePosted
└── Internal (Private)
    ├── sales_orders_temp table
    ├── internal job schedulers
    └── internal utilities
```

Other modules can:
- Call /api/sales/orders
- Subscribe to SalesOrderCreated event
- Use published data models

Other modules cannot:
- Query sales_orders_temp directly
- Call internal schedulers
- Access internal utilities

---

## Communication Patterns

### Pattern 1: Synchronous API Calls

**Use Case**: One module needs immediate response from another module.

**Example**: Sales module checks inventory availability

```
Sales Module
    ↓
GET /api/inventory/stock/{itemId}
    ↓
Inventory Module
    ↓
Returns: { available: 100, reserved: 20, total: 120 }
```

**Characteristics**:
- Immediate response required
- Caller waits for completion
- Failure is immediate and visible
- Used for read-only or simple operations

**Guidelines**:
- Keep synchronous calls fast (< 100ms)
- Use for queries, lookups, validations
- Avoid long-running operations
- Have timeout strategy for failures

### Pattern 2: Asynchronous Events (Future)

**Use Case**: One module notifies others of business events.

**Example**: Sales Order created event triggers Inventory reservation and Accounting posting

```
Sales Module creates order
    ↓
Publishes: SalesOrderCreated { orderId, items... }
    ↓
Event Bus
    ↓
┌──────────────────┬───────────────────┬─────────────────┐
│                  │                   │                 │
Inventory Module  Accounting Module   CRM Module
(Reserves Stock)  (Posts Ledger)     (Updates Activity)
```

**Characteristics**:
- Fire-and-forget
- Asynchronous processing
- Loosely coupled modules
- No immediate response
- Potential delays

**Guidelines**:
- Use for notifications of business events
- Define event schema (versioned)
- Include traceability (correlation ID)
- Implement retry logic
- Have dead-letter queue

**Status**: Deferred to future volumes; currently use synchronous APIs.

### Pattern 3: Data Synchronization (Future)

**Use Case**: One module maintains read-only copy of another module's data.

**Example**: Accounting module maintains customer master copy from Sales

```
Sales Module
    (Source of Truth)
    ↓
Publishes: CustomerMasterUpdated
    ↓
Accounting Module
    (Subscribes, maintains local copy)
```

**Characteristics**:
- Eventual consistency
- Asynchronous replication
- Potential staleness
- Reduced coupling

**Guidelines**:
- Only copy data you own
- Handle failures and retries
- Implement reconciliation jobs
- Document refresh frequency
- Monitor synchronization lag

**Status**: Deferred to future volumes.

---

## Allowed Dependencies

### Dependency Direction Rules

```
✓ Allowed:
  Sales Module → Inventory API (sales depends on inventory)
  Sales Module → Auth Service (sales depends on auth)
  Inventory Module → Accounting API (inventory depends on accounting)

✗ Forbidden:
  Inventory Module → Sales API (inventory doesn't depend on sales)
  Auth Service → Sales Module (platform doesn't depend on modules)
  Circular: Sales → Inventory → Sales
```

### Platform Service Dependencies

All modules depend on platform services:

```
Sales Module
Inventory Module
Accounting Module
HR Module
Manufacturing Module
    ↓
    ├── Authentication Service
    ├── Authorization Service
    ├── Audit Service
    ├── Notification Service
    ├── File Storage Service
    ├── Configuration Service
    ├── Scheduler Service
    └── Reporting Service
```

Platform services are owned by the platform team and versioned independently.

### Dependency Matrix

| From | To | Allowed | Rationale |
|------|----|---------|-----------| 
| Any Module | Platform Service | ✓ Yes | Modules depend on common services |
| Sales | Inventory | ✓ Yes | Sales checks stock |
| Inventory | Sales | ✗ No | Inventory shouldn't know about sales |
| Manufacturing | Sales | ✗ No | Manufacturing independent from sales |
| Accounting | Sales | ✓ Yes | Accounting posts sales transactions |
| Sales | Accounting | ✗ No | Accounting is downstream |
| Inventory | Accounting | ✓ Yes | Inventory posts transactions |
| Accounting | Inventory | ✗ No | Accounting doesn't control inventory |

### Justification

This dependency direction aligns with data flow and business logic:
- Sales creates orders
- Orders affect Inventory and Accounting
- Inventory records movements
- Movements affect Accounting
- Accounting is the final record of transactions

Inverse dependencies would create circular logic and violate module independence.

---

## Integration Patterns

### Pattern: Read API for Integration

A module publishes read APIs that other modules use to check status or retrieve data:

```
Sales Order Processing:

1. Sales creates order
2. Sales checks: GET /api/inventory/stock
3. Inventory returns: { available: yes/no }
4. Sales checks: GET /api/accounting/customer-balance
5. Accounting returns: { balance, creditLimit }
6. Sales proceeds or rejects
```

Benefits:
- Simple point-to-point
- Immediate consistency
- No event infrastructure needed
- Easy to understand

Drawbacks:
- Tight coupling
- Multiple calls per transaction
- Caller responsible for consistency

### Pattern: Anti-Corruption Layer (Future)

When integrating with external systems or legacy modules, use anti-corruption layer:

```
Sales Module
    (Uses Sales Domain Model)
    ↓
Anti-Corruption Layer
    (Translates between domains)
    ↓
Legacy System
    (Uses Legacy Domain Model)
```

Benefits:
- Isolates domain models
- Enables gradual migration
- Reduces coupling

**Status**: Deferred to future volumes.

---

## Module Communication Checklist

Before module A calls module B, verify:

- ✓ Module B publishes the API being called
- ✓ The API is documented and versioned
- ✓ The call is in allowed dependency direction
- ✓ Error handling is implemented
- ✓ Timeout handling is implemented
- ✓ Audit logging is in place
- ✓ Integration is tested

---

## Scalability Implications

The modular architecture supports independent scaling:

```
High-Traffic Modules:
  - Sales Module (scale more)
  - Inventory Module (scale more)

Low-Traffic Modules:
  - Assets Module (scale less)
  - CRM Module (scale less)

Platform Services:
  - Auth Service (scale based on all modules)
  - Audit Service (scale based on all modules)
```

Each module can be deployed with its own scaling rules.

---

## Circular Dependency Prevention

Circular dependencies block independent evolution. The architecture prevents them:

### Example 1: Correct Design

```
Sales → Inventory → Accounting
(No cycles)
```

Each module can evolve independently. Sales can add features without affecting Inventory; Inventory can add features without affecting Accounting.

### Example 2: Wrong Design (Circular)

```
Sales → Inventory → Accounting → Sales
(Creates cycle)
```

Accounting wants to create commission entries for Sales. If Accounting calls back to Sales, we create a cycle:
- Sales → Inventory (for stock check)
- Inventory → Accounting (for costs)
- Accounting → Sales (for commissions)

**Solution**: Use events or decouple through platform service:

```
Sales creates order
    ↓ (publishes event)
SalesOrderCreated
    ↓
Accounting subscribes
    (creates commission entry)
    ↓
(No cycle; accounting doesn't call sales)
```

---

## API Versioning

Modules publish versioned APIs to support safe evolution:

```
GET /api/v1/sales/orders (legacy clients)
GET /api/v2/sales/orders (new clients)
```

**Guidelines**:
- Maintain backward compatibility within a major version
- Support N-1 versions minimum
- Deprecate with advance notice
- Document breaking changes

---

## Dependency Checking

Architectural boundaries are enforced through automated tools:

```bash
# Check for circular dependencies
npm run lint:dependencies

# Check for unauthorized imports
npm run lint:modules

# Validate API contracts
npm run lint:contracts
```

These checks run in CI/CD to prevent boundary violations.

---

## Module Communication Sequence

### Order Entry with Multiple Module Integration

```
Client: POST /api/sales/orders
    ↓
API Layer validates request
    ↓
SalesOrderService.create()
    │
    ├─→ CustomerService.get(customerId)
    │   └─→ Check customer exists
    │
    ├─→ GET /api/inventory/stock
    │   └─→ Check item availability
    │
    ├─→ GET /api/accounting/customer-balance
    │   └─→ Check credit limit
    │
    ├─→ StockRepository.reserve(itemId, quantity)
    │   └─→ Update stock in database
    │
    ├─→ SalesOrderRepository.create(order)
    │   └─→ Insert order in database
    │
    ├─→ LedgerService.postOrder(order)
    │   └─→ POST to /api/accounting/entries
    │
    ├─→ AuditService.log()
    │   └─→ Insert audit record
    │
    └─→ Publish event: SalesOrderCreated
        (for future modules via event bus)

Response to Client: 201 Created
```

Each step is independent; failures are handled appropriately.

---

## Related Documents

- **[System Architecture](./02-system-architecture.md)** — Layers within which boundaries apply
- **[Module Architecture](../08-business-modules/README.md)** — How to structure modules
- **[Platform Services](../09-platform-services/README.md)** — Shared services all modules use
- **[Architectural Principles](../00-overview/01-architectural-principles.md)** — Principles governing boundaries

---

## Summary

Module boundaries enable:
- Independent development and testing
- Independent deployment and scaling
- Clear responsibility and ownership
- Reduced complexity
- Future extensibility

Boundaries are maintained through:
- Published APIs as contracts
- Database isolation
- Controlled dependencies
- Automated enforcement
- Documentation

All module communication must respect these boundaries to maintain architectural integrity.

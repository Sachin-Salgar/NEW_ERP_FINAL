# Architectural Boundaries & Communication

**Document Purpose**: Define module boundaries, communication patterns, and rules for inter-module integration.

**Audience**: Architects, module leads, integration teams

---

## Introduction

Modules in the ERP platform must remain independent while working together as an integrated system. The ERP currently uses a **Modular Monolith**: all business modules run inside a single deployable backend application, while their internal implementation boundaries remain enforced.

Module independence therefore means **logical and code-level isolation**, not independent deployment at the current stage.

This document defines:

- How modules establish boundaries
- How modules communicate
- What dependencies are allowed
- How to maintain independence while supporting integration
- Which future communication mechanisms remain deferred

---

## Module Boundaries

### Published Interfaces

Each module has published interfaces that other modules can depend on:

**What modules can know**:
- Published service interfaces
- Published REST APIs (`/api/{module}/...`)
- Published data models (schemas, DTOs)
- Published domain events when event architecture is approved and implemented
- Documented service contracts
- Versioned API specifications

**What modules cannot depend on**:
- Internal implementation details
- Private methods or services
- Another module's internal repositories
- Another module's internal database tables directly
- Undocumented APIs
- Framework internals

### Boundary Enforcement

Module boundaries are enforced through:

1. **Database access**: A module must not directly access another module's internal persistence structures.
2. **Imports**: Backend code dependency checks prevent unauthorized internal imports.
3. **Contracts**: Cross-module communication uses published interfaces/contracts.
4. **Architecture tests**: CI checks should detect circular or unauthorized module dependencies.

The shared PostgreSQL database does not make every table a public integration interface. Ownership remains with the module that owns the data.

### Example Module Boundary

```
Sales Module
├── Public API
│   ├── /api/sales/orders
│   ├── /api/sales/customers
│   └── /api/sales/invoices
├── Domain Events (when approved)
│   ├── SalesOrderCreated
│   ├── SalesOrderApproved
│   └── InvoicePosted
└── Internal (Private)
    ├── sales_orders_temp persistence
    ├── internal job schedulers
    └── internal utilities
```

Other modules can:
- Call published Sales interfaces
- Use approved published event contracts when event architecture is available
- Use published data contracts

Other modules cannot:
- Query Sales internal persistence directly
- Call internal schedulers
- Access internal utilities

---

## Communication Patterns

### Pattern 1: In-Process Published Service Interfaces

Because the ERP is currently a modular monolith, modules may communicate through published in-process service interfaces where the architecture and module contract permit it.

**Use Case**: One module needs an immediate response from another module without introducing a network hop.

**Guidelines**:
- Depend only on the target module's published contract.
- Do not bypass the target module's business rules or repository boundary.
- Avoid circular dependencies.
- Keep transaction ownership explicit.
- Test the contract at module boundaries.

### Pattern 2: Synchronous REST API Calls

REST is the external/client API contract and may also be used for explicitly defined module integration boundaries where required. Internal module calls should prefer the documented in-process contract unless the architecture explicitly requires a network boundary.

**Use Case**: An integration requires an API boundary or a future extracted service.

**Guidelines**:
- Keep synchronous calls fast where used.
- Use for queries, lookups, and operations requiring an immediate response.
- Avoid long-running operations.
- Define timeout and failure handling when a network call exists.

### Pattern 3: Asynchronous Events

**Status: Approved and implemented through the transactional outbox architecture defined by ADR-0020.**

Use events only where an approved event contract exists. The current modular-monolith implementation uses in-process contracts and a PostgreSQL-backed outbox/dispatcher; an external broker remains optional and requires the relevant deployment or architecture decision.

### Pattern 4: Data Synchronization — Deferred

Read-model replication and asynchronous synchronization are future capabilities. They require an approved architecture and explicit ownership/reconciliation rules before implementation.

---

## Allowed Dependencies

### Dependency Direction Rules

Dependencies must follow explicitly approved module relationships. The examples below are illustrative, not a substitute for a maintained dependency matrix.

```
✓ Example allowed:
  Sales Module → Inventory published contract
  Sales Module → Platform Services

✗ Forbidden:
  Module → another module's internal repository
  Platform Service → Business Module
  Circular: Sales → Inventory → Sales
```

### Platform Service Dependencies

Business modules may depend on platform services through published contracts:

```
Business Modules
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

Platform services must not take dependencies on business modules merely to implement shared platform behavior.

### Dependency Matrix

The dependency matrix must be maintained as module specifications are implemented. The examples below are initial directional guidance:

| From | To | Allowed | Rationale |
|------|----|---------|-----------|
| Any Module | Platform Service | ✓ Yes | Modules may use common platform services |
| Sales | Inventory | ✓ Only through published contract | Sales may need stock availability |
| Inventory | Sales | ✗ Default | Avoid reverse dependency unless explicitly approved |
| Manufacturing | Sales | ✗ Default | Preserve module independence |
| Accounting | Sales | ✓ Only through published contract when required | Accounting may consume sales business data |
| Sales | Accounting | ✓ Only through published contract when required | Sales may require accounting validation/posting |
| Inventory | Accounting | ✓ Only through published contract when required | Inventory may require accounting integration |
| Accounting | Inventory | ✓ Only through published contract when required | Allowed when a documented business capability requires inventory data |

A future dependency-checking mechanism must validate actual module dependencies against an authoritative matrix rather than hard-code the illustrative examples above.

---

## Integration Patterns

### Pattern: Published Contract for Integration

A module publishes a contract that another module consumes. The consuming module must not access the provider's persistence layer directly.

Benefits:
- Explicit ownership
- Easier testing
- Reduced coupling
- Future extraction readiness

### Pattern: Anti-Corruption Layer — Future

When integrating with external systems or legacy domains, use an anti-corruption layer where the architecture requires translation between domain models.

**Status**: Deferred until an applicable integration requires it.

---

## Module Communication Checklist

Before module A calls module B, verify:

- Module B publishes the contract being called
- The contract is documented and versioned where applicable
- The dependency direction is permitted
- Transaction ownership is understood
- Error handling is implemented
- Timeout handling exists when a network call is involved
- Audit logging is in place where required
- Integration is tested
- No internal persistence or implementation detail is being bypassed

---

## Scalability Implications

The modular monolith is currently deployed as a single application. Module boundaries should nevertheless allow future extraction if a later approved architecture decision requires independent scaling or deployment.

Future extraction is an architectural change and requires an approved ADR before implementation.

---

## Circular Dependency Prevention

Circular dependencies block independent evolution. They must be prevented at the module boundary.

If two modules require mutual behavior, do not introduce reciprocal internal dependencies merely to make the immediate feature work. Prefer a platform capability, a higher-level orchestration boundary, or a formally approved event/contract pattern as appropriate.

---

## API Versioning

External REST APIs use the versioning strategy defined by the current API standards. Do not invent a versioning scheme for a feature if the API governance documentation has not established it.

Where API versioning is not yet fully specified, implementation must identify the open decision rather than silently choosing a breaking-change policy.

---

## Dependency Checking

Architectural boundaries are intended to be enforced through automated checks such as:

```bash
npm run lint:dependencies
npm run lint:modules
npm run lint:contracts
```

These commands are architectural requirements/placeholders until the backend implementation defines their actual tooling. The AI workflow must not claim these commands pass unless they exist and were executed successfully.

---

## Related Documents

- **[System Architecture](./02-system-architecture.md)** — Layers within which boundaries apply
- **[Backend Modular Monolith](../04-backend/03-modular-monolith.md)** — Current deployment and module architecture
- **[Module Architecture](../08-business-modules/README.md)** — How to structure modules
- **[Platform Services](../09-platform-services/README.md)** — Shared services
- **[Architectural Principles](../00-overview/01-architectural-principles.md)** — Principles governing boundaries

---

## Summary

The ERP currently uses a **Modular Monolith**:

- One deployable backend application
- Strong logical/code boundaries between modules
- Published contracts for cross-module communication
- No direct access to another module's internal persistence
- Explicit dependency direction
- Future service extraction only through approved architecture decisions

This model is the current source of truth for module deployment boundaries.

# Business Modules Architecture

This directory contains standards for business module design, structure, and implementation patterns.

## Module Architecture

Each business module shall follow a common internal structure:

| Component | Purpose |
|-----------|---------|
| **Database Objects** | Tables, constraints, indexes specific to module |
| **Domain Model** | Core business concepts and entities |
| **Business Services** | Business logic and rule implementation |
| **REST APIs** | Module's public API endpoints |
| **Permissions** | Module-specific permissions and roles |
| **Reports** | Module-specific reports and queries |
| **Configuration** | Module-specific configuration and settings |
| **Tests** | Unit, integration, and end-to-end tests |
| **Documentation** | Module design and usage documentation |

This standardization reduces development complexity and improves maintainability.

### Module Boundary Principles

**Module Independence**:
- Every module shall be independently maintainable.
- Modules expose only published interfaces.
- Modules avoid unnecessary dependencies.
- Modules remain independent of the internal implementation details of other modules.
- The ERP is currently a modular monolith; module independence does **not** mean independent deployment.

**Module Communication**:
- External/client integration uses published REST APIs.
- Within the modular monolith, modules may communicate through published in-process service contracts where permitted by the architecture.
- A REST call may be used for an explicitly defined integration boundary, but modules must not bypass published contracts.
- No direct database access to another module's internal tables.
- Modules depend on published contracts, not implementations.
- Modules depend only on approved platform services.

**Architectural Boundaries**:
- Each module is a bounded context.
- Each module has clear responsibility.
- Each module exposes clean interfaces to other modules.
- Coupling is minimized and dependency direction is explicit.
- Future independent deployment/extraction requires an approved ADR.

### Business Modules

The ERP includes these business modules:

| Module | Purpose | Integration |
|--------|---------|-------------|
| **Sales** | Order-to-cash processing | Inventory (stock check), Accounting (posting) |
| **Purchase** | Procure-to-pay processing | Inventory (receipt), Accounting (posting) |
| **Inventory** | Stock and warehouse management | Accounting (valuation) |
| **Manufacturing** | Production planning and execution | Inventory (consumption), Accounting (posting) |
| **Accounting** | Financial records and reporting | All modules (receives transactions) |
| **Human Resources** | Employee and organizational data | Payroll (feeds salary), Accounting |
| **Payroll** | Salary and benefits processing | Accounting (posting) |
| **Assets** | Fixed asset management | Accounting (depreciation) |
| **CRM** | Customer relationship management | Sales (customer data) |

### Module Licensing

Organizations subscribe to specific modules:

**Required Modules**:
- Organization & Branch Management
- Accounting (required for any business)
- Human Resources (core platform)
- Payroll (core platform)

**Optional Modules**:
- Sales
- Purchase
- Inventory
- Manufacturing
- Assets
- CRM
- Future modules

**Feature Enablement**:
- Unlicensed modules hidden from UI.
- API endpoints inaccessible for unlicensed modules.
- Module enablement via configuration.
- Dynamic UI updates based on licensed modules.

### Module Development Standards

When developing a module:

1. **Design Phase**: Define module boundaries and APIs.
2. **Database Phase**: Design tables and constraints.
3. **Service Layer**: Implement business logic and cross-module contract usage.
4. **API Layer**: Expose REST endpoints required by clients/integrations.
5. **Testing**: Unit, integration, and end-to-end tests.
6. **Documentation**: API docs and design docs.
7. **Security**: Permission definitions and audit events.

**Standards**:
- Follow architectural principles.
- Follow naming conventions.
- Follow API design patterns.
- Include comprehensive tests.
- Document architectural decisions via ADRs when required.

---

## Related Documentation

- [Architectural Boundaries](../02-architecture/03-boundaries.md) — Module communication and isolation
- [System Architecture](../02-architecture/02-system-architecture.md) — Module architecture within layers
- [Design Philosophy](../02-architecture/01-design-philosophy.md) — Module-relevant principles
- [Business Objectives](../01-vision/02-business-objectives.md) — Modular architecture objective

## Status

This document defines current module architecture principles. Detailed module specifications are added under this directory as individual modules are designed and approved.

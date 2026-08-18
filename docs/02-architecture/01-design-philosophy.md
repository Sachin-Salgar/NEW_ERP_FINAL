# Design Philosophy

**Document Purpose**: Establish the philosophical foundation for architectural decisions and design patterns used throughout the ERP platform.

**Audience**: Architects, technical leads, senior developers

---

## Introduction

The architecture of an enterprise software platform determines its ability to evolve over time. While features can be added, modified, or removed throughout the product lifecycle, changing the underlying architecture becomes increasingly expensive as the system grows.

For this reason, the ERP platform shall be designed around a small number of fundamental architectural principles. These principles are intended to remain stable throughout the lifetime of the product and shall guide all technical decisions.

Every component, module, database object, service, and user interface shall be evaluated against these principles before implementation.

---

## Design Philosophy 1: Platform First, Modules Second

### Statement

The ERP shall not be developed as a collection of unrelated applications. Instead, the project shall first establish a stable ERP platform providing common capabilities. Business modules shall consume these platform capabilities rather than implementing duplicate functionality.

### Rationale

Building a platform first ensures:
- **Consistency**: Modules can share common authentication, audit, and notification capabilities
- **Reusability**: Platform capabilities don't get reimplemented in each module
- **Maintenance**: Fixing a platform capability benefits all consumers
- **Governance**: Security, audit, and compliance rules are enforced consistently
- **Scalability**: Shared capabilities can be optimized globally

### Shared Platform Capabilities

The ERP platform provides common capabilities including:

| Capability | Purpose | Usage |
|---------|---------|-------|
| **Authentication** | User login, token management | As required by modules/clients |
| **Authorization** | Role-based permissions | As required by modules/clients |
| **Audit Logging** | Immutable transaction logs | Business-critical operations |
| **Notification** | User alerts, escalations | As required by workflows/modules |
| **File Storage** | Document management | As required by modules |
| **Configuration** | Organization settings | As required by modules |
| **Scheduler** | Background jobs | As required by modules |
| **Reporting Infrastructure** | Report engine, scheduling | As required by reporting features |
| **Module Registration** | Module lifecycle management | Platform |

### Consequence

Business modules must not:
- Implement their own authentication where the platform capability applies
- Implement their own audit logging where the platform audit capability applies
- Implement duplicate notification infrastructure
- Implement duplicate configuration infrastructure
- Duplicate an existing platform capability

This ensures platform stability and consistent behavior across modules.

---

## Design Philosophy 2: API-First Development

### Statement

Business functionality shall be exposed through well-defined backend API contracts. The backend is the primary business platform; client applications shall communicate through the API boundary.

### Rationale

API-first development ensures:
- **Consistency**: Same business rules across desktop, web, mobile
- **Testability**: APIs can be tested independently of clients
- **Flexibility**: Client implementation can change without backend changes
- **Integration**: External systems use documented APIs
- **Evolution**: New client types can be added without duplicating business logic

### Application of API-First

```
Business Logic API (REST)
    ↑
    ├── Flutter Desktop Client
    ├── Flutter Web Client
    ├── Flutter Mobile Client
    ├── Third-party Integration
    ├── Mobile App (future)
    └── Public API (future)
```

All communication between clients and business logic flows through the REST API boundary. No client directly accesses the database.

### Benefit

Organizations can:
- Replace Flutter with React without backend changes
- Add a mobile app without changing backend APIs
- Integrate with third-party systems through documented APIs
- Test APIs independently of UI changes
- Version APIs independently of client versions

---

## Design Philosophy 3: Database First Philosophy

### Statement

Persistent data models shall be designed early and jointly with domain models, process requirements, reporting needs, integrity rules, scalability targets, and migration strategy. Application code shall adapt to the database model rather than continuously restructuring the database to satisfy temporary implementation requirements.

### Rationale

Database design is foundational because:
- **Integrity**: Database constraints enforce business rules at the source
- **Performance**: Good indexes and structure prevent slow queries
- **Consistency**: ACID transactions ensure data reliability
- **Reporting**: Database structure should support analytical needs
- **Longevity**: Enterprise systems live 10+ years; database design must be stable

### Design Approach

1. **Understand the Business**: Know business processes, entities, relationships
2. **Model the Domain**: Create logical data model reflecting business concepts
3. **Design for Integrity**: Implement constraints that protect data validity
4. **Optimize for Access**: Design structures supporting queries, reports, analytics
5. **Plan for Scale**: Consider growth in users, transactions, data volume
6. **Plan for Migration**: Ensure future changes don't require massive refactoring

### Consequence

The application code adapts to the database, not the reverse. If the database design is sound, application code remains clean and maintainable.

### Example

Bad approach: Application randomly adds columns to tables as new features are needed, resulting in a schema that reflects implementation history rather than business reality.

Good approach: Think through the data model upfront. What does a customer really look like? How do they relate to orders, invoices, payments? Design once, implement consistently.

---

## Design Philosophy 4: Business Logic Centralization

### Statement

Business logic shall exist only within backend services. The frontend shall never become responsible for enforcing business policies.

### Rationale

Centralizing business logic ensures:
- **Consistency**: Rules apply identically on all platforms
- **Security**: Rules cannot be bypassed by client-side manipulation
- **Maintainability**: Changes to rules happen in one place
- **Auditability**: Rules can be traced in audit logs
- **Testability**: Rules can be tested independently

### Business Rules

Backend services are exclusively responsible for:
- Stock calculations
- Ledger postings
- Tax computation
- Credit validation
- Approval workflows
- Inventory reservations
- Manufacturing planning
- Discount validation
- GST calculations
- Workflow execution
- Permission enforcement

### Frontend Validation

Frontend applications may perform validation for user experience, but this is never authoritative:
- "This field is required" (UX validation only)
- "Email format is invalid" (UX validation; backend validates)
- "Stock not available" (UX message; backend validates in business logic)

Backend always independently validates that the operation is permitted and correct.

### Example

A sales order with a customer who has exceeded credit limit:

```
Frontend:
  - May show warning "Customer credit limit exceeded"
  - Cannot prevent user from entering the order
  - Submits order to backend

Backend:
  - Validates customer credit limit
  - Enforces business rule: "No orders for credit-exceeded customers"
  - Rejects order with error message
  - Creates audit record of rejection
```

---

## Design Philosophy 5: Separation of Concerns

### Statement

Each architectural layer shall have a clearly defined responsibility and communicate only through clearly defined interfaces.

### Layer Responsibilities

**Presentation Layer (Client Applications)**:
- **Responsible for**: User Interface, User Interaction, Data Presentation
- **Not responsible for**: Database access, Financial calculations, Security decisions

**Business Layer (Backend Services)**:
- **Responsible for**: Business rules, Workflow execution, Validation, Permission enforcement
- **Not responsible for**: User interface rendering

**Data Layer (Database)**:
- **Responsible for**: Data persistence, Transactions, Query optimization, Constraints
- **Not responsible for**: Business decisions

### Architectural Consequences

- Layers communicate through defined contracts (API contracts, data models)
- No layer should know implementation details of other layers
- Each layer can be tested independently
- Each layer can be updated without affecting others

### Dependency Direction

Dependencies flow from presentation toward business logic and then toward data access:

```
Presentation → Business Logic → Data Access
```

The Business Layer depends on Data Layer interfaces, while the concrete data-access implementation remains behind those interfaces. The Data Layer does not depend on the Business Layer.

---

## Design Philosophy 6: Configuration Over Customization

### Statement

Organizations should configure the ERP rather than modify its source code. Configuration examples include Financial Years, Company Information, Tax Settings, Approval Levels, Branches, Number Series, and Workflows.

### Rationale

Configuration over customization ensures:
- **Upgradability**: Customers can upgrade without losing customizations
- **Simplicity**: No forked codebases to maintain
- **Support**: Vendors can support customers uniformly
- **SaaS Readiness**: Multi-tenant SaaS requires standardized customization
- **Sustainability**: Reduces technical debt from custom code

### Configuration Examples

**Tax Settings** (Configuration):
- Organization configures tax rates for its jurisdiction
- Tax calculation code applies configured rates
- No customization needed

**Approval Workflows** (Configuration):
- Organization configures approval levels (Manager, Director, VP)
- Workflow engine executes configured workflow
- No customization needed

**Number Series** (Configuration):
- Organization configures invoice numbering format
- ERP applies configured format
- No customization needed

### Customization Exception

Source-code customization should remain exceptional, approved through formal process, and documented for future development teams.

---

## Design Philosophy 7: Convention Over Configuration

### Statement

Wherever practical, the ERP shall provide sensible defaults including Standard folder structures, Naming conventions, API routing, Permission naming, and Module registration. Reducing unnecessary configuration simplifies development and maintenance.

### Rationale

Conventions reduce:
- **Learning curve**: New developers follow established patterns
- **Decision load**: "How do I organize this module?" has an answer
- **Variation**: Modules look similar, making them easier to understand
- **Customization**: Sensible defaults eliminate unnecessary configuration

### Convention Examples

**Folder Structure Convention**:
```
src/
  modules/
    sales/
      domain/
      services/
      controllers/
      dto/
      tests/
```

Every module follows the same structure. New developers know where to look.

**API Route Convention**:
```
GET    /api/sales/orders              (list)
GET    /api/sales/orders/{id}         (get)
POST   /api/sales/orders              (create)
PUT    /api/sales/orders/{id}         (update)
DELETE /api/sales/orders/{id}         (delete)
```

Standard RESTful patterns for all modules.

**Permission Naming Convention**:
```
sales:orders:create
sales:orders:read
sales:orders:update
sales:orders:delete
sales:orders:approve
```

Predictable permission names.

### Benefit

Developers can make reasonable guesses about where to find code or how to implement features without consulting documentation.

---

## Design Philosophy 8: Documentation Driven Development

### Statement

Major architectural decisions shall be documented before implementation, answering Why this approach was selected, Which alternatives were considered, What limitations exist, and What future impact the decision has. Documentation shall evolve alongside the software.

### Rationale

Documentation-driven development ensures:
- **Clarity**: Decisions made intentionally, not accidentally
- **Traceability**: Future developers understand "why"
- **Continuity**: Knowledge survives team changes
- **Consistency**: Later decisions build on earlier ones, not contradict them
- **Efficiency**: Prevents rework when original decision is forgotten

### ADR Process

Architecture Decision Records (ADRs) document:
1. **Context**: What problem are we solving?
2. **Decision**: What did we decide?
3. **Rationale**: Why this choice?
4. **Alternatives**: What else did we consider?
5. **Consequences**: What are the tradeoffs?
6. **References**: What does this affect?

Every significant architectural decision requires an ADR.

### Living Documentation

Documentation evolves alongside code:
- When implementation reveals issues, document the reality
- When business needs change, update the documentation
- Outdated documentation is a defect

---

## Summary

These eight design principles form the philosophical foundation of the ERP platform. They guide all technical decisions and remain stable throughout the product's lifecycle.

When uncertainty exists about how to design a component or solve a problem, evaluate the solution against these principles:

1. Does it support platform-first thinking?
2. Does it align with API-first development?
3. Does it support good database design?
4. Does it centralize business logic properly?
5. Does it maintain separation of concerns?
6. Does it favor configuration over customization?
7. Does it follow established conventions?
8. Is it documented?

If a proposed design violates these principles, reconsider.

---

## Related Documents

- **[System Architecture](./02-system-architecture.md)** — How principles are applied
- **[Architectural Boundaries](./03-boundaries.md)** — Separation of concerns in practice
- **[Architectural Principles](../00-overview/01-architectural-principles.md)** — Ten mandatory principles
- **[Technology Stack](../05-frontend/README.md)** — Technology selections based on philosophy

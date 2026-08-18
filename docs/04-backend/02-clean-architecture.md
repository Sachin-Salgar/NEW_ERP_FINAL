# Clean Architecture & Layered Design

**Document Purpose**: Define the Clean Architecture and layered design used by backend services.

**Audience**: Architects, backend developers, system designers

---

## 1. Introduction

Large enterprise applications become difficult to maintain when business rules, database operations, validation, and API logic are mixed together.

To avoid this problem, the Enterprise ERP Platform adopts Clean Architecture combined with a Layered Design.

Each layer has a clearly defined responsibility and communicates only through well-defined interfaces.

This separation improves maintainability, testing, scalability, and code readability.

## 2. Objectives

The layered architecture aims to:

- Separate responsibilities.
- Improve maintainability.
- Simplify testing.
- Reduce coupling.
- Increase reusability.
- Support future architectural evolution.

## 3. Architectural Layers

The backend is organized into the following logical layers:

```text
Presentation Layer
        |
        v
Application Layer
        |
        v
Domain Layer
        ^
        |
Infrastructure Layer
        |
        v
External systems / Database
```

The dependency rule is inward: domain logic must not depend on framework or infrastructure implementations. Outer layers may depend on inner-layer abstractions according to the established backend structure.

## 4. Presentation Layer

Responsibilities:

- REST APIs.
- Request parsing.
- Response formatting.
- Authentication handling.
- Authorization handling at the API boundary.
- Request validation.
- Error handling.

This layer contains Fastify routes and controllers. It should contain minimal business logic.

## 5. Application Layer

Responsibilities:

- Use cases.
- Business workflow orchestration.
- Transaction coordination.
- Application-service orchestration.
- Coordination of published module contracts where required.

Examples:

- Create Customer.
- Post Sales Invoice.
- Approve Purchase Order.
- Process Payroll.

This layer coordinates business operations without depending directly on concrete storage implementations.

## 6. Domain Layer

The Domain Layer contains:

- Business Rules.
- Entities.
- Value Objects.
- Domain Services.
- Domain Events where applicable.

This is the heart of the ERP. The domain should remain independent of databases, frameworks, or user interfaces.

A domain event does not by itself imply distributed event infrastructure. Asynchronous/distributed event processing requires the relevant approved architecture and contracts.

## 7. Infrastructure Layer

Responsibilities include technical implementations for:

- PostgreSQL access.
- Drizzle ORM.
- Email services.
- File storage.
- External APIs.
- Cache.
- Logging.

Infrastructure provides implementations required by the higher layers and must not move business rules into infrastructure code merely for convenience.

## 8. Dependency Direction

Dependencies must respect the Clean Architecture dependency rule.

```text
Presentation
     |
     v
Application
     |
     v
Domain
     ^
     |
Infrastructure
```

The Domain Layer must never depend directly on Fastify, Drizzle ORM, PostgreSQL, or other infrastructure implementations.

Infrastructure may implement interfaces/ports defined by inner layers where required.

## 9. Benefits

Clean Architecture provides:

- Easier testing.
- Better modularity.
- Lower maintenance cost.
- Framework independence.
- Long-term scalability.

## 10. Summary

By separating technical concerns from business logic, the ERP remains adaptable to future technological changes while preserving the integrity of its business rules.

---

## Cross References

- `docs/04-backend/01-backend-overview.md`
- `docs/04-backend/03-modular-monolith.md`
- `docs/02-architecture/01-design-philosophy.md`

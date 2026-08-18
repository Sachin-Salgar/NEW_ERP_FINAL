# Core System Architecture

This directory contains the fundamental system architecture, design philosophy, and architectural layers that form the foundation of the ERP platform.

## Documents Contained

1. **[Design Philosophy](./01-design-philosophy.md)**: Core design principles guiding architecture decisions
2. **[System Layering & Architecture](./02-system-architecture.md)**: Layered architecture, components, and their responsibilities
3. **[Architectural Boundaries & Communication](./03-boundaries.md)**: Module boundaries, communication patterns, and isolation rules

## Purpose

The documents in this section define:

- **Why we design the way we do** — Design Philosophy
- **How the system is organized** — Layers, modules, and services
- **How components communicate** — Communication patterns and boundaries
- **What responsibilities belong where** — Separation of concerns

## Architectural Approach

The ERP uses a **Layered Modular Monolith Architecture** with clear separation between:

- **Client Layer** — User-facing applications (Flutter Desktop, Web, Mobile)
- **API Layer** — REST API, request handling, validation, routing
- **Business Layer** — Business rules, workflows, calculations, approvals
- **Data Layer** — Database access, transactions, constraints, integrity
- **Platform Services** — Shared services (Auth, Audit, Notifications, etc.)

The backend is a **single deployable application** containing independently bounded business modules. Module independence means strong ownership and dependency boundaries inside the monolith; it does **not** currently mean that each module is independently deployable.

This layering ensures:
- Independent evolution of each layer
- Business logic isolation from presentation and persistence
- Consistent application of business rules
- Clear responsibility boundaries
- Testability and maintainability

## Key Architectural Decisions

| Decision | Rationale | Owner |
|----------|-----------|-------|
| **Layered Architecture** | Clear separation of concerns, independent evolution | Architecture Board |
| **Modular Monolith** | Single deployment with disciplined module boundaries and lower operational complexity | Architecture Board |
| **Platform Services First** | Consistent authentication, audit, notifications across modules | Platform Team |
| **API-First Development** | Same APIs serve desktop, web, mobile; consistent business logic | Backend Team |
| **Database First Design** | Data model before code; ACID transactions; referential integrity | Database Team |
| **Backend Business Logic** | Consistent rules, no client bypass, security, auditability | Architecture Board |
| **Module Independence** | Modules own their internals and communicate through published contracts within the monolith | Module Architects |

## Architecture Patterns

The system implements these architectural patterns:

- **Layered Architecture**: Horizontal layers for separation of concerns
- **Modular Monolith**: Independently bounded business modules in one deployable backend
- **Repository Pattern**: Abstraction of data access
- **Service Layer Pattern**: Business rule encapsulation
- **Event-Driven Architecture**: Deferred where explicitly marked TBD/Proposed; it is not an implicit implementation choice
- **Dependency Injection**: Inversion of control, testability

## System Context

```
┌─────────────────────────────────────────────────────────┐
│                    Client Applications                  │
│  ┌──────────────┬─────────────────┬──────────────────┐  │
│  │ Flutter      │  Flutter Web    │  Flutter Mobile  │  │
│  │ Desktop      │  (Browsers)     │  (Android, iOS)  │  │
│  └──────────────┴─────────────────┴──────────────────┘  │
└──────────────────────────────┬──────────────────────────┘
                               │
                    ┌──────────▼────────────┐
                    │  REST API Layer       │
                    │ (Validation, Auth,    │
                    │  Routing, Response)   │
                    └──────────┬────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
    ┌─────▼──────┐    ┌────────▼────────┐   ┌──────▼──────┐
    │  Business  │    │  Business       │   │  Business   │
    │  Services  │    │  Services       │   │  Services   │
    │  (Sales,   │    │  (Accounting,   │   │  (Inventory,│
    │  Purchase) │    │  HR, Payroll)   │   │  Manufact.) │
    └─────┬──────┘    └────────┬────────┘   └──────┬──────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
         ┌─────────────────────┼──────────────────────┐
         │   Platform Services │ (Auth, Audit, etc.)  │
         ├─────────────────────┼──────────────────────┤
         │  Repository Layer   │ (Data Access)        │
         └─────────────────────┼──────────────────────┘
                               │
                    ┌──────────▼────────────┐
                    │  PostgreSQL Database  │
                    │  (Multi-tenant,       │
                    │   ACID, RLS)          │
                    └───────────────────────┘
```

## Related Documentation

- **[Design Philosophy](./01-design-philosophy.md)** — Why we design the way we do
- **[System Architecture](./02-system-architecture.md)** — Detailed layer descriptions
- **[Architectural Boundaries](./03-boundaries.md)** — Module boundaries and communication
- **[Backend Architecture](../04-backend/README.md)** — Backend runtime and modular monolith architecture
- **[Technology Stack](../05-frontend/README.md)** — Technology choices
- **[Architectural Principles](../00-overview/01-architectural-principles.md)** — Governing principles

## Navigation

**New to the architecture?** Start with:
1. [Design Philosophy](./01-design-philosophy.md) — Understand the "why"
2. [System Architecture](./02-system-architecture.md) — Understand the "how"
3. [Architectural Boundaries](./03-boundaries.md) — Understand module isolation

**Designing a new module?** See:
- [System Layering](./02-system-architecture.md) — Understand module structure
- [Module Architecture](../08-business-modules/README.md) — Module design standards
- [Platform Services](../09-platform-services/README.md) — Available shared services

**Making architectural changes?** See:
- [Architecture Decision Records](../10-adr/README.md) — How to document decisions
- [Governance](../00-overview/02-governance.md) — Approval process

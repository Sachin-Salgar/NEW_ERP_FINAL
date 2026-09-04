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

## 9. Provider-Neutral External Capabilities

External infrastructure and service providers shall be accessed through stable application-level contracts or ports when the capability is part of an application workflow. Vendor- or technology-specific implementations belong in infrastructure or deployment adapters. Domain and application logic must remain independent of cloud SDKs, provider protocols, and infrastructure-specific connection details.

Provider selection and operational settings are deployment configuration, not business logic. A capability is not considered implemented merely because an architectural port exists: the implementation status below distinguishes repository evidence from deployment/provider validation.

| Capability | Application contract required | Infrastructure adapter | Configuration driven | Vendor-specific code allowed | Current implementation status |
|---|---|---|---|---|---|
| Database | Yes — repository contracts, connection manager, and transaction abstractions | PostgreSQL/Drizzle infrastructure | Yes — `DATABASE_URL`, pool, SSL, and tenant-context settings | Infrastructure only | Implemented with PostgreSQL/RLS; PostgreSQL remains the authoritative database |
| Authentication / Identity | Yes — authentication, token, identity, and tenant-context contracts | Local credential/session/JWT infrastructure; external identity adapters only if adopted | Yes — validated authentication and JWT settings | Infrastructure only | Local authentication and JWT implemented; external IdP integration is not currently implemented |
| Email / Notifications | Yes — `NotificationServicePort` and channel-provider contracts | Channel delivery adapters | Required for any deployed provider; no provider is selected by business code | Infrastructure/deployment adapters only | Provider-neutral queue, templates, leasing, retry, and worker foundation implemented; concrete delivery provider remains deployment work |
| File/Object Storage | Yes — `ObjectStorageProvider` and metadata repository/service contracts | Object-storage adapter | Required for any deployed provider; credentials remain deployment secrets | Infrastructure/deployment adapters only | Provider-neutral file service and PostgreSQL metadata implemented; concrete storage adapter/deployment remains pending |
| Background Jobs | Yes — durable job-store and handler contracts | PostgreSQL-backed queue and worker process | Worker lifecycle and retry settings are deployment concerns | Infrastructure/deployment adapters only | Database-backed queue/worker foundation implemented; production worker operation remains pending |
| Scheduler | Yes — `SchedulerServicePort`, scheduled-job store, and handler contracts | PostgreSQL-backed scheduler worker | Schedule definitions and worker settings are configuration/data | Infrastructure/deployment adapters only | Durable one-time/recurring scheduler and worker foundation implemented; deployment operation remains pending |
| Cache | Only if a cache is introduced for an approved use case | None currently implemented | Not currently applicable | No cache vendor is selected | Future capability; architecture permits selective cache introduction when consistency and scale justify it |
| Search | Only when a search capability is approved and implemented | None currently implemented | Not currently applicable | No search vendor is selected | Not currently required by the implemented backend |
| Distributed Lock | Only where a reusable application capability requires one | PostgreSQL advisory/row-lock mechanisms currently used by infrastructure workflows | Deployment/database capability, not business configuration | Infrastructure only | No general provider port; migration coordination uses PostgreSQL locking and remains infrastructure-owned |
| Observability | Application logging, audit, and correlation contracts where needed; no generic vendor port is required | Structured logger, PostgreSQL audit logger, and deployment log sink | Yes — log level and deployment sink settings | Infrastructure/deployment adapters only | Structured logging, audit, correlation, health, and aggregate query monitoring implemented; external observability sink is deployment work |
| Secrets | A dedicated provider port is not required by the current application boundary | Environment/deployment secret injection | Yes — typed configuration validates secret inputs | Secret-manager SDKs only in deployment/infrastructure adapters | Secret values are externalized and validated; no vendor secret manager is selected |
| CI/CD / Registry | No runtime application contract | GitHub Actions workflows and registry publishing configuration | Yes — workflow/repository configuration | CI/deployment layer only | CI and release workflows are implemented; hosted execution and registry permissions remain deployment validation |
| External APIs | Capability-specific contracts are required before an integration is adopted | Integration adapters behind those contracts | Yes — endpoints, timeouts, retry policy, and credentials where implemented | Infrastructure/deployment adapters only | No generic external-API adapter is implemented; outbox transport and notification/storage ports provide only their approved capability boundaries |

This matrix does not make a provider mandatory. It records the current boundary and prevents an implementation or deployment choice from becoming an implicit business-module dependency. Tenant-owned capabilities must retain explicit tenant context, authorization, audit, soft-delete, and transaction rules; provider selection must never bypass PostgreSQL RLS or authenticated request context.

## 10. Benefits

Clean Architecture provides:

- Easier testing.
- Better modularity.
- Lower maintenance cost.
- Framework independence.
- Long-term scalability.

## 11. Summary

By separating technical concerns from business logic, the ERP remains adaptable to future technological changes while preserving the integrity of its business rules.

---

## Cross References

- `docs/04-backend/01-backend-overview.md`
- `docs/04-backend/03-modular-monolith.md`
- `docs/02-architecture/01-design-philosophy.md`

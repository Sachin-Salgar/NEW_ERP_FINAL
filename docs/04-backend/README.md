# Backend Architecture

This directory contains the authoritative backend architecture, runtime, framework, API, infrastructure, quality, and module-development standards for the Enterprise ERP Platform.

The backend is currently implemented as a **modular monolith**. Modules are logically independent in ownership and boundaries, but are not separately deployed services. Internal module interaction uses published application/service contracts and events where appropriate; external clients and integrations use the REST API.

## Documents Contained

### Overview
- [01-backend-overview.md](01-backend-overview.md) — Backend architecture overview and responsibilities

### Core Architecture
- [02-clean-architecture.md](02-clean-architecture.md) — Clean Architecture and layered design
- [03-modular-monolith.md](03-modular-monolith.md) — Current modular-monolith architecture
- [04-domain-driven-design.md](04-domain-driven-design.md) — Domain-Driven Design (DDD)
- [05-dependency-injection-ioc.md](05-dependency-injection-ioc.md) — Dependency Injection and IoC

### API & Integration
- [06-api-design-standards.md](06-api-design-standards.md) — API design standards and REST architecture
- [07-authentication-and-authorization.md](07-authentication-and-authorization.md) — Authentication and authorization

### Services & Business Logic
- [08-service-layer-design.md](08-service-layer-design.md) — Service-layer responsibilities and transactions
- [09-repository-pattern.md](09-repository-pattern.md) — Repository pattern and data-access guidance

### Data, Validation & Error Handling
- [10-validation-strategy.md](10-validation-strategy.md) — Validation strategy
- [11-error-handling-framework.md](11-error-handling-framework.md) — Error handling and correlation IDs

### Events & Asynchronous Processing
- [12-event-driven-architecture.md](12-event-driven-architecture.md) — Event-driven architecture and contracts
- [13-background-jobs-queue-processing.md](13-background-jobs-queue-processing.md) — Background jobs and queue processing

### Infrastructure & Operations
- [14-file-storage-architecture.md](14-file-storage-architecture.md) — File storage and metadata
- [15-notification-framework.md](15-notification-framework.md) — Notification framework
- [16-logging-and-observability.md](16-logging-and-observability.md) — Logging, metrics, health checks, and observability
- [17-caching-strategy.md](17-caching-strategy.md) — Caching policy, consistency, and keying
- [18-configuration-management.md](18-configuration-management.md) — Configuration management and secrets

### Quality & Performance
- [19-testing-strategy.md](19-testing-strategy.md) — Unit, integration, and end-to-end testing strategy
- [20-performance-optimization.md](20-performance-optimization.md) — Performance engineering and load testing

### Module Development
- [21-module-development-guidelines.md](21-module-development-guidelines.md) — Module structure, boundaries, responsibilities, and development rules

## Backend Runtime

### Node.js

Node.js is the selected backend runtime environment for the ERP backend.

**Responsibilities:**
- Host the backend application.
- Execute application and business logic.
- Manage database connections through the application data-access layer.
- Coordinate module services.

### Backend Language: TypeScript

All backend production code shall be written in TypeScript.

Plain JavaScript shall not be used for production backend code.

### Web Framework: Fastify

Fastify is the selected HTTP framework.

**Responsibilities:**
- Expose REST APIs.
- Handle HTTP requests and responses.
- Provide routing and request handling.
- Participate in validation and error handling according to the backend standards.

### Backend Responsibilities

The backend is responsible for:
- **Business Rules:** Enforcing authoritative business policies.
- **Calculations:** Stock calculations, tax computation, financial postings, and other domain calculations.
- **Workflows:** Approval chains and business processes.
- **Validation:** Request, business, and domain constraint validation as applicable.
- **Security:** Authentication, authorization, tenant/organization isolation, and required security controls.
- **Audit:** Producing authoritative audit records where required by the security/database architecture.
- **Integration:** Coordinating with the database, platform capabilities, and external integrations.

### Business Logic Centralization

All authoritative business logic must be implemented in the backend/domain and application layers. Frontend code must not be the authoritative enforcement point for business policies.

Frontend applications may perform UX validation, but the backend independently validates and enforces all security and business rules.

### CPU-Heavy Workloads

CPU-intensive workloads such as large report generation, complex optimization, manufacturing planning, or batch processing must not block API event-loop processing. They should use the worker/job architecture when the workload requires asynchronous or isolated processing.

## Architectural Boundary Rules

- Modules own their business logic and authoritative data-access boundaries.
- Direct dependencies on another module's internal implementation are prohibited.
- Cross-module writes are prohibited.
- Justified read-only cross-module access is permitted under the database architecture, particularly for approved reporting/read-model use cases.
- Internal module interaction uses published application/service interfaces and events where appropriate.
- REST APIs are the external communication interface for clients and integrations.
- Module enablement/licensing for an organization is separate from user authorization within that organization.

## Related Documentation

- [System Architecture](../02-architecture/02-system-architecture.md) — Overall system architecture
- [Backend Overview](./01-backend-overview.md) — Backend architecture
- [Backend Modular Monolith](./03-modular-monolith.md) — Current backend deployment architecture
- [Design Philosophy](../02-architecture/01-design-philosophy.md) — Architectural principles
- [Backend Module Development](./21-module-development-guidelines.md) — Module implementation rules
- [Global Governance](../00-overview/02-governance.md) — Global document control and governance
- [Coding Standards](../02-architecture/05-coding-standards.md) — Global coding standards
- [Security](../06-security/01-backend-security.md) — Backend security requirements
- [Deployment Architecture](../07-devops/01-deployment-architecture.md) — Deployment architecture and CI/CD
- [Architecture Decision Records](../10-adr/README.md) — ADRs

## Navigation

Start with:
- [Backend Overview](./01-backend-overview.md)
- [Clean Architecture](./02-clean-architecture.md)
- [Modular Monolith](./03-modular-monolith.md)
- [API Standards](./06-api-design-standards.md)
- [Authentication & Authorization](./07-authentication-and-authorization.md)
- [Module Development Guidelines](./21-module-development-guidelines.md)
- [Testing Strategy](./19-testing-strategy.md)

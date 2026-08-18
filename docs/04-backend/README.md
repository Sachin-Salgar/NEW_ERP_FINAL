# Backend Architecture

This directory contains backend runtime, framework, and server-side technology standards.

## Documents Contained

### Overview
- [01-backend-overview.md](01-backend-overview.md) — Backend architecture overview and high-level responsibilities
- [27-volume3-summary.md](27-volume3-summary.md) — Backend architecture summary and key decisions

### Core Architecture
- [02-clean-architecture.md](02-clean-architecture.md) — Clean Architecture & Layered Design
- [03-modular-monolith.md](03-modular-monolith.md) — Modular Monolith approach
- [04-domain-driven-design.md](04-domain-driven-design.md) — Domain-Driven Design (DDD)
- [05-dependency-injection-ioc.md](05-dependency-injection-ioc.md) — Dependency Injection and IoC

### API & Integration
- [06-api-design-standards.md](06-api-design-standards.md) — API design standards and REST architecture
- [07-authentication-and-authorization.md](07-authentication-and-authorization.md) — Authentication & Authorization

### Services & Business Logic
- [08-service-layer-design.md](08-service-layer-design.md) — Service layer responsibilities and transactions
- [09-repository-pattern.md](09-repository-pattern.md) — Repository pattern and data access guidance

### Data, Validation & Error Handling
- [10-validation-strategy.md](10-validation-strategy.md) — Validation strategy
- [11-error-handling-framework.md](11-error-handling-framework.md) — Error handling and correlation IDs

### Events & Asynchronous Processing
- [12-event-driven-architecture.md](12-event-driven-architecture.md) — Event-driven architecture and contracts
- [13-background-jobs-queue-processing.md](13-background-jobs-queue-processing.md) — Background jobs and queue processing

### Infrastructure & Operations
- [14-file-storage-architecture.md](14-file-storage-architecture.md) — File storage and metadata
- [15-notification-framework.md](15-notification-framework.md) — Notification framework
- [16-logging-and-observability.md](16-logging-and-observability.md) — Logging, metrics and health checks
- [17-caching-strategy.md](17-caching-strategy.md) — Caching policy and keying
- [18-configuration-management.md](18-configuration-management.md) — Configuration management and secrets

### Quality & Performance
- [19-testing-strategy.md](19-testing-strategy.md) — Testing strategy (unit/integration/e2e)
- [20-performance-optimization.md](20-performance-optimization.md) — Performance guidance and load testing

### Module Development
- [21-module-development-guidelines.md](21-module-development-guidelines.md) — Module structure, responsibilities, and documentation requirements

### Cross references (canonical)
- [Governance (global)](../00-overview/02-governance.md) — Global document control and governance
- [Coding Standards (global)](../02-architecture/05-coding-standards.md) — Global coding standards
- [Security (global)](../06-security/01-backend-security.md) — Backend security requirements
- [DevOps / Deployment](../07-devops/01-deployment-architecture.md) — Deployment architecture and CI/CD
- [ADRs](../10-adr/README.md) — Architecture Decision Records
- [Migration Traceability](../migration-traceability/volume3-to-docs.md) — Historical mapping from the former Volume 3 material to current canonical documents

## Backend Runtime

### Node.js

Node.js is the selected backend runtime environment for the ERP backend.

**Responsibilities**:
- Host the backend application
- Execute business logic
- Manage database connections
- Coordinate module services

### Backend Language: TypeScript

All backend production code shall be written in TypeScript.

Plain JavaScript shall not be used for production backend code.

### Web Framework: Fastify

Fastify is the selected HTTP framework.

**Responsibilities**:
- Expose REST APIs
- Handle HTTP requests/responses
- Validation and routing
- Error handling

### Backend Responsibilities

The Backend Layer is responsible for:
- **Business Rules**: Enforcing business policies
- **Calculations**: Stock calculations, tax computation, financial postings
- **Workflows**: Approval chains and business processes
- **Validation**: Business constraint validation
- **Security**: Permission enforcement and required security controls
- **Audit**: Logging of business operations
- **Integration**: Coordinating with database and platform services

### Business Logic Centralization

All business logic must be implemented in backend services. Frontend code must not be the authoritative enforcement point for business policies.

Frontend may perform UX validation, but backend independently validates all business rules.

### CPU-Heavy Workloads

CPU-intensive workloads such as large report generation, complex optimization, manufacturing planning, or batch processing must not block API event loops. They should run through the worker/job architecture defined by the backend documentation when required.

## Related Documentation

- [System Architecture](../02-architecture/02-system-architecture.md) — Business layer description
- [Backend Modular Monolith](./03-modular-monolith.md) — Current backend deployment architecture
- [Design Philosophy](../02-architecture/01-design-philosophy.md) — Business Logic Centralization
- [Backend Module Development](./21-module-development-guidelines.md) — Module implementation rules

## Navigation

Start with:
- [Backend Overview](./01-backend-overview.md)
- [Clean Architecture](./02-clean-architecture.md)
- [Modular Monolith](./03-modular-monolith.md)
- [API Standards](./06-api-design-standards.md)
- [Testing Strategy](./19-testing-strategy.md)

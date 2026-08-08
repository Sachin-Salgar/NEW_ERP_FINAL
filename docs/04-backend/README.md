# Backend Architecture

This directory contains backend runtime, framework, and server-side technology standards.

## Documents Contained (organized)

### Overview
- [01-backend-overview.md](01-backend-overview.md) — Backend Architecture overview and high-level responsibilities
- [27-volume3-summary.md](27-volume3-summary.md) — Volume 3 summary and key decisions

### Core Architecture
- [02-clean-architecture.md](02-clean-architecture.md) — Clean Architecture & Layered Design
- [03-modular-monolith.md](03-modular-monolith.md) — Modular Monolith approach
- [04-domain-driven-design.md](04-domain-driven-design.md) — Domain-Driven Design (DDD)

### API & Integration
- [06-api-design-standards.md](06-api-design-standards.md) — API design standards and REST architecture
- [07-authentication-and-authorization.md](07-authentication-and-authorization.md) — Authentication & Authorization

### Services & Business Logic
- [08-service-layer-design.md](08-service-layer-design.md) — Service layer responsibilities and transactions
- [09-repository-pattern.md](09-repository-pattern.md) — Repository pattern and data access guidance

### Data, Validation & Error Handling
- [10-validation-strategy.md](10-validation-strategy.md) — Validation strategy (Zod, multi-layer)
- [11-error-handling-framework.md](11-error-handling-framework.md) — Error handling and correlation IDs

### Events & Asynchronous Processing
- [12-event-driven-architecture.md](12-event-driven-architecture.md) — Event-driven architecture and contracts
- [13-background-jobs-queue-processing.md](13-background-jobs-queue-processing.md) — Background jobs and queue processing

### Infrastructure & Operations
- [14-file-storage-architecture.md](14-file-storage-architecture.md) — File storage and metadata
- [15-notification-framework.md](15-notification-framework.md) — Notification framework (templates & channels)
- [16-logging-and-observability.md](16-logging-and-observability.md) — Logging, metrics and health checks
- [17-caching-strategy.md](17-caching-strategy.md) — Caching policy and keying
- [18-configuration-management.md](18-configuration-management.md) — Configuration management and secrets

### Quality & Performance
- [19-testing-strategy.md](19-testing-strategy.md) — Testing strategy (unit/integration/e2e)
- [20-performance-optimization.md](20-performance-optimization.md) — Performance guidance and load testing

### Module Development
- [21-module-development-guidelines.md](21-module-development-guidelines.md) — Module structure, responsibilities, and documentation requirements

### Cross references (canonical)
- [Governance (global)](../00-overview/02-governance.md) — Document Control & Governance (single source of truth)
- [Coding Standards (global)](../02-architecture/05-coding-standards.md) — Global coding standards
- [Security (global)](../06-security/01-backend-security.md) — Backend security best practices
- [DevOps / Deployment](../07-devops/01-deployment-architecture.md) — Deployment architecture and CI/CD
- [ADRs](../10-adr/README.md) — Architecture Decision Records index
- [Migration Traceability](../migration-traceability/volume3-to-docs.md) — Mapping from Volume 3 to repo files

This directory contains backend runtime, framework, and server-side technology standards. For further details see the linked documents above.

This directory contains backend runtime, framework, and server-side technology standards.

## From Volume 1

### Backend Runtime: Node.js

**Selection Rationale**: Node.js has been selected as the backend runtime environment due to:
- High performance for I/O-heavy operations
- Large ecosystem with extensive packages
- Asynchronous architecture supporting concurrent requests
- Excellent API development frameworks
- Mature package ecosystem
- Cross-platform support (Windows, Linux, macOS)

**Responsibilities**:
- Host all backend services for the ERP
- Execute business logic
- Manage database connections
- Coordinate module services

### Backend Language: TypeScript

**Selection Rationale**: All backend development shall be performed using TypeScript due to:
- Static typing for type safety
- Improved maintainability
- Better IDE support and autocompletion
- Compile-time error detection
- Easier refactoring
- Better developer productivity

**Standard**: Plain JavaScript shall not be used for production backend code. All backend code must be TypeScript.

### Web Framework: Fastify

**Selection Rationale**: Fastify has been selected as the preferred HTTP framework due to:
- High performance
- Schema-based validation
- Excellent TypeScript support
- Plugin architecture for modularity
- Low overhead

**Responsibilities**:
- Expose all REST APIs
- Handle HTTP requests/responses
- Validation and routing
- Error handling

### Backend Responsibilities

The Backend Layer is responsible for:
- **Business Rules**: Enforcing all business policies
- **Calculations**: Stock calculations, tax computation, financial postings
- **Workflows**: Approval chains, business processes
- **Validation**: Business constraint validation
- **Security**: Permission enforcement, encryption
- **Audit**: Logging of all business operations
- **Integration**: Coordinating with database and platform services

### Business Logic Centralization

**Critical Principle**: All business logic must be implemented in backend services. Frontend cannot enforce business policies.

Examples of backend-only logic:
- Stock calculations
- Ledger postings
- Tax computation
- Credit limit validation
- Approval workflows
- Inventory reservations
- Manufacturing planning
- Discount validation

Frontend may perform UX validation (e.g., "field required"), but backend independently validates all business rules.

### CPU-Heavy Workloads

Node.js is strong for I/O-heavy APIs but may have limitations for CPU-heavy tasks such as:
- Large report generation
- Complex optimization algorithms
- Manufacturing planning calculations
- Batch data processing

**Guidance**: CPU-intensive workloads should run in isolated workers or specialized services and must not block API event loops.

---

## Related Documentation

- [System Architecture](../02-architecture/02-system-architecture.md) — Business Layer description
- [Technology Stack](../05-frontend/README.md) — Backend technology selection
- [Design Philosophy](../02-architecture/01-design-philosophy.md) — Business Logic Centralization
- [Volume 3 — Backend Architecture](../archive/Enterprise ERP Software Architecture - Volume 3 – Backend Architecture.md) — Detailed backend standards

## Navigation

This volume (Volume 1) provides architectural principles for backend design. See **Volume 3** for:
- Backend service structure
- API design standards
- Error handling patterns
- Middleware architecture
- Service composition patterns
- Dependency injection standards
- Testing strategies
- Performance optimization
- Worker thread patterns
- Job queue architecture

# Backend Architecture

This directory contains backend runtime, framework, and server-side technology standards.

## Documents Contained

This section is reserved for Volume 3 detailed content (Backend Architecture).

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
- [Volume 3 — Backend Architecture](../../Enterprise%20ERP%20Software%20Architecture%20-%20Volume%203%20–%20Backend%20Architecture.md) — Detailed backend standards

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

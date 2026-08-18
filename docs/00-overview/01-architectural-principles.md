# Architectural Principles

**Document Purpose**: Define the ten mandatory architectural principles that govern all ERP design and implementation.

**Audience**: All architects, developers, QA engineers, DevOps engineers, technical leads

**Authority**: These principles are binding unless explicitly superseded by an approved Architecture Decision Record.

---

## Introduction

Architectural principles define the mandatory rules that govern the design and implementation of every component within the ERP platform. Unlike recommendations, these principles are mandatory unless explicitly overridden through an approved Architecture Decision Record.

Every developer, architect, and contributor is expected to understand and follow these principles.

---

## Principle 1: Backend Owns Business Logic

**Statement**: The backend is the authoritative source of business behavior. All business policies must be implemented exclusively within backend services.

**Scope**: All business rules without exception

**Responsibilities of Backend**:
- Stock calculations
- Ledger postings
- Tax computation
- Credit validation
- Approval workflows
- Manufacturing planning
- Inventory reservations
- Financial calculations
- Discount validation
- GST calculations
- Workflow execution
- Permission enforcement

**Consequences of Violation**:
- Business rule duplication across clients (desktop, mobile, web)
- Client-side rule bypass attacks
- Inconsistent business behavior
- Difficult testing and maintenance

**Example**: A stock availability check must be performed by the backend API, never by the client. Even if the client checks available stock, the backend must revalidate before processing a sales order.

---

## Principle 2: Frontend Is Presentation Only

**Statement**: Frontend applications exist to display information, collect user input, and communicate with APIs. Frontend must never become the primary source of business decisions.

**Scope**: All client applications (Flutter Desktop, Flutter Web, Flutter Android, future web/mobile clients)

**Frontend Responsibilities**:
- User interface rendering
- User interaction handling
- Data presentation and formatting
- Form validation (for UX only)
- API communication
- Navigation

**Frontend Non-Responsibilities**:
- Business rule enforcement
- Financial calculations
- Inventory logic
- Security decisions
- Database access

**Consequence**: Frontend applications may perform user experience validations (e.g., "this field is required"), but these checks do not replace backend validation. Every business rule shall ultimately be enforced by the backend.

**Example**: A form may show "Email is invalid" when a user enters invalid format, but the backend must independently validate email format, uniqueness, and domain verification.

---

## Principle 3: Database Is the Single Source of Truth

**Statement**: Business information stored within PostgreSQL represents the official organizational record. No client application shall maintain independent business data outside officially supported synchronization mechanisms.

**Scope**: All persistent data storage

**Implications**:
- The database is authoritative for all business state
- Clients cache data temporarily but do not own business records
- All data modifications flow through the backend
- Offline caches are temporary, not authoritative

**Example**: A mobile app may cache customer data for offline access, but the customer record of truth is in PostgreSQL. When the app reconnects, it must resynchronize with the backend.

---

## Principle 4: Modules Must Remain Independent

**Statement**: Every module shall be independently maintainable, expose only its published interfaces, and avoid unnecessary dependencies upon one another.

**Scope**: All business modules and platform capabilities

**What Modules Should Know**:
- Published contracts of other modules
- Shared platform contracts
- Documented integration events where explicitly supported by the current architecture

**What Modules Should Avoid**:
- Another module's internal implementation details
- Direct database access to another module's tables
- Undocumented internal services
- Implicit dependencies
- Direct access to another module's private repositories or persistence implementation

**Current Deployment Model**: The ERP backend is a modular monolith with one deployable backend application. Module independence means logical and code-level isolation, controlled dependencies, clear ownership, and independent testability; it does not mean independent deployment.

**Purpose**: This isolation allows modules to be developed, tested, and evolved independently within the modular monolith while preserving clear boundaries. Future independent deployment or service extraction requires an approved Architecture Decision Record.

**Example**: The Sales module should integrate with Inventory through the Inventory module's published application/service contract, not by directly querying Inventory database tables. This allows Inventory to change its internal structure without breaking Sales.

---

## Principle 5: Platform Before Features

**Statement**: Platform stability is more important than rapid feature development. Infrastructure such as Authentication, Authorization, Logging, Notifications, and Reporting Infrastructure shall exist before dependent modules are developed.

**Scope**: Project phasing and development order

**Platform Foundational Services**:
- Authentication Service
- Authorization Service
- Notification Service
- File Storage Service
- Audit Service
- Reporting Infrastructure
- Configuration Service
- Scheduler Service

**Purpose**: Shared platform services ensure consistency, prevent duplication, and support centralized governance.

**Example**: Before developing the Sales module, the platform must have a functioning authentication service and authorization framework. The Sales module must use the shared platform services rather than implementing its own authentication.

---

## Principle 6: Configuration Before Customization

**Statement**: Organizations should adapt the ERP using configuration rather than source-code modifications. Source-code modifications should remain exceptional.

**Scope**: Organizational adaptation

**Configuration Examples**:
- Financial Years
- Company Information
- Tax Settings
- Approval Levels
- Branches
- Number Series
- Workflows
- Module Enablement

**Consequence**: Organizations should manage their business through ERP configuration, not by maintaining custom code forks. Source-code customization is an architectural anti-pattern.

**Example**: To change an approval workflow, an organization should configure approval levels through the ERP interface, not by modifying backend source code.

---

## Principle 7: Security by Design

**Statement**: Security shall be incorporated into every architectural layer through Authentication, Authorization, Encryption, Input Validation, Audit Logging, and Secure Communication. Security shall never be treated as a feature added after implementation.

**Scope**: All architectural layers

**Security Controls at Each Layer**:

**Presentation Layer**:
- CSRF tokens for state-changing operations
- Secure storage of tokens on client
- HTTPS only
- Input validation for UX

**API Layer**:
- Authentication validation
- Authorization checks
- Input validation
- Rate limiting
- Secure error messages

**Business Layer**:
- Business rule enforcement
- Permission checks
- Audit event generation

**Data Layer**:
- Encryption at rest (where required)
- Row-level security policies
- Referential integrity constraints
- Audit trail enforcement

**Example**: When a user deletes a record, security checks must occur at the API layer (authorization), business layer (business rule validation), and data layer (constraint enforcement).

---

## Principle 8: Audit Everything Important

**Statement**: Critical business operations shall generate audit records for Login, Logout, Record Creation, Updates, Deletion, Approvals, and Permission Changes. Audit records shall support traceability and accountability.

**Scope**: All business-critical operations

**Audit Record Minimum Content**:
- Actor identity (user, system, service)
- Tenant identity
- Timestamp
- Operation type (create, update, delete, approve, reject)
- Affected record identifier
- Before/after values (for updates)
- Correlation ID
- IP address / device information
- Approval/authorization status

**Audit Operations**:
- Login / Logout
- Record creation
- Record updates
- Record deletion
- Record approval / rejection
- Permission grants
- Permission revocations
- Privileged access
- Failed authorization attempts
- Sensitive data access or export
- Background job execution

**Example**: When a user creates a purchase order, an immutable audit record must capture who created it, when, what values were set, and remain permanently for compliance and forensic purposes.

---

## Principle 9: Consistency Over Convenience

**Statement**: Architectural consistency is more valuable than isolated developer convenience. Developers shall follow established conventions for Naming, Folder Structure, APIs, Database Design, Error Handling, and Logging.

**Scope**: All development and architecture decisions

**Why Consistency Matters**:
- Reduces cognitive load for teams
- Improves code quality
- Simplifies maintenance
- Reduces defect density
- Improves developer onboarding
- Enables easier code reviews
- Supports automated tooling

**Consistency Areas**:
- Naming conventions (variables, functions, classes, tables)
- Folder structure
- API design patterns
- Database naming and structure
- Error handling patterns
- Logging conventions
- Testing patterns
- Documentation standards

**Example**: If one module names its user-retrieval endpoint `/api/users/{id}`, all modules should follow the same pattern. A developer's convenience in using a different pattern is less valuable than consistency across the platform.

---

## Principle 10: Documentation Is Part of the Product

**Statement**: Architecture documentation is mandatory. Whenever significant architectural decisions are made, documentation shall be updated accordingly. Outdated documentation is considered a defect.

**Scope**: All architectural decisions and technical standards

**Documentation Artifacts**:
- Software Architecture Document (this series)
- Architecture Decision Records (ADRs)
- API documentation (OpenAPI)
- Database schema documentation
- Configuration documentation
- Deployment procedures
- Security architecture

**Living Documentation**: Documentation must evolve alongside the software. When code changes materially affect architecture, documentation must be updated.

**Example**: If the team decides to change from a synchronous request-response pattern to an event-driven pattern in a module, an Architecture Decision Record must be created explaining the decision, and this architecture document must be updated to reflect the new pattern.

---

## Decision-Making Hierarchy

When uncertainty exists, architectural decisions shall follow this order of precedence:

1. **Software Architecture Document (SAD)** — This documentation
2. **Architecture Decision Records (ADRs)** — Approved decisions supersede SAD sections
3. **Development Standards** — Detailed implementation standards
4. **Module Specifications** — Module-specific design documents
5. **Source Code** — NOT the primary architectural reference

---

## Summary

These ten principles establish the non-negotiable engineering standards for the ERP platform. They provide a common foundation that allows the platform to evolve while maintaining consistency, quality, and long-term maintainability.

**Enforcement**: Every development team must understand these principles and apply them to their work. Architecture reviews, code reviews, and process audits must verify adherence.

**Evolution**: These principles are expected to remain stable. Changes to architectural principles require an approved Architecture Decision Record.

---

## Related Documentation

- [Document Control & Governance](./02-governance.md) — Decision-making process and governance
- [System Architecture](../02-architecture/README.md) — How these principles are applied
- [Architecture Decision Records](../10-adr/README.md) — How exceptions are documented

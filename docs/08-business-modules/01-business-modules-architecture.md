# Business Modules Architecture

**Status:** Current authoritative architecture
**Scope:** Logical business-module boundaries within the ERP modular monolith

## 1. Purpose

The ERP is organized into business modules that own distinct business capabilities while participating in one unified platform. Modules are logical boundaries inside the current modular-monolith backend; they are not independently deployed services.

The module architecture provides clear ownership, explicit contracts, controlled dependencies, and independently testable domain behavior. Future extraction of a module into an independently deployed service is possible only through an approved architecture decision.

## 2. Business Module Principles

Business modules shall:

- own their business processes and domain rules;
- maintain module-specific configuration where applicable;
- expose explicitly defined application/API contracts;
- consume platform capabilities only when required;
- avoid direct access to another module's internal implementation;
- avoid direct access to another module's private persistence implementation;
- maintain clear ownership and dependency boundaries;
- remain testable independently within the modular monolith.

"Module independence" means logical and code-level isolation, not independent deployment.

## 3. Current Deployment Model

The current ERP backend is a **modular monolith with one deployable backend application**.

```text
                    ERP Backend
                         |
                 Modular Monolith
                         |
          +--------------+--------------+
          |                             |
   Platform Capabilities          Business Modules
          |                             |
          +-------- Published ----------+
                   Contracts
                         |
                    PostgreSQL
```

Independent processes, microservices, or distributed module deployment are not part of the current architecture and must not be introduced speculatively. Such a change requires an approved ADR.

## 4. Module Communication

### 4.1 In-process communication — current default

Modules within the modular monolith communicate through explicitly published application/service contracts.

```text
Module A
   |
   | published contract
   v
Module B
```

A module must not call another module's private classes, repositories, or persistence implementation directly.

### 4.2 External communication

REST/API contracts are used at the external client and integration boundary.

```text
Client / Integration
        |
        v
   REST API boundary
        |
        v
   Backend module
```

### 4.3 Business events

Business events may be represented as domain/application events where required by the current implementation. However, the existence of a conceptual business event does **not** imply a distributed event broker.

Kafka, RabbitMQ, message brokers, distributed consumers, or similar infrastructure must not be introduced unless explicitly required by authoritative architecture documentation or an approved ADR.

## 5. Shared Platform Capabilities

Business modules may consume common platform capabilities through their published contracts. Typical capabilities include:

- Authentication
- Authorization
- User Management
- Organization Management
- Branch Management
- Audit Logging
- Notification
- Document Management
- File Storage
- Reporting
- Workflow
- Configuration
- Scheduling

A module must not automatically depend on every platform capability. Its actual dependencies are defined by its module specification and implementation needs.

## 6. Module Categories

The ERP may organize business functionality into categories such as:

- Core Administration
- Sales & Customer Management
- Procurement
- Inventory & Warehouse
- Finance & Accounting
- Human Resources
- Manufacturing
- Customer Service
- Project Management
- Analytics & Reporting

The authoritative module specification and current roadmap determine which modules are actually in scope for implementation.

## 7. Module Dependency Rules

Module dependencies shall be explicit and shall avoid circular dependencies.

Dependencies may include:

- platform capability dependencies;
- synchronous application/service-contract dependencies;
- approved integration dependencies;
- reporting dependencies;
- workflow dependencies;
- event-based dependencies where the current architecture explicitly supports them.

A dependency must not be inferred merely from a conceptual relationship between business processes.

For example, Sales may require Inventory information for fulfillment and Finance integration for accounting consequences, but the implementation mechanism must follow the authoritative contracts and transaction rules of those modules.

## 8. Data Ownership

Each module owns its domain data and persistence behavior.

Other modules must not directly query or mutate another module's private tables, repositories, or persistence implementation. Cross-module data access must use the owning module's published contract or an explicitly approved shared/platform mechanism.

Database-level tenant isolation, RLS, audit, soft-delete, and transaction rules remain governed by the authoritative database and security documentation.

## 9. Future Module Extraction

The modular-monolith architecture is intentionally compatible with future extraction where justified by scale, operational requirements, or organizational needs.

Future extraction is not an implicit requirement and must not be implemented speculatively.

Any transition to independently deployed services requires an approved ADR addressing, at minimum:

- service boundary;
- contract ownership;
- data ownership and migration;
- transaction boundaries;
- authentication and authorization;
- observability;
- deployment and operations;
- failure and retry behavior.

## 10. Implementation Rule for AI

When implementing a business feature, AI must:

1. identify the owning business module;
2. read its authoritative specification;
3. identify required platform capabilities and module dependencies;
4. preserve the current modular-monolith architecture;
5. use published contracts rather than private cross-module implementation access;
6. avoid introducing microservices, distributed deployment, or message-broker infrastructure unless explicitly authorized by authoritative documentation or an approved ADR.

If the required module boundary, contract, data ownership, or integration behavior is not specified, AI must stop and identify the ambiguity rather than invent an architectural decision.

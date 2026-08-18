# Technology Stack

**Document Purpose:** Define the official technology stack for the ERP platform and establish technology governance.

**Audience:** All technical staff, procurement, operations

---

## Introduction

Technology selection influences maintainability, performance, developer productivity, deployment flexibility, scalability, and long-term sustainability.

The technologies described here constitute the current official technology stack for the ERP platform. Specific versions shall be governed by the repository's actual toolchain and dependency manifests; this document does not invent version numbers where implementation has not yet established them.

---

## Technology Overview

| Layer | Technology | Version Policy | Justification |
|---|---|---|---|
| Frontend Framework | Flutter | Current project-supported stable release | Single codebase, multiple platforms |
| Frontend Language | Dart | Current project-supported stable release | Strong typing and Flutter integration |
| Backend Runtime | Node.js | Current supported LTS | Async I/O and mature ecosystem |
| Backend Language | TypeScript | Current project-supported stable release | Type safety and maintainability |
| Web Framework | Fastify | Current project-supported stable release | Performance and schema/plugin support |
| Database | PostgreSQL | Current project-supported version | ACID, RLS, reliability |
| ORM | Drizzle ORM | Current project-supported version | Type-safe PostgreSQL access |
| Validation | Zod | Current project-supported version | Runtime schema validation |
| Authentication | JWT | Standard | Token-based authentication |
| Version Control | Git | Current supported release | Distributed version control |
| Package Manager | pnpm | Repository-selected version | Reproducible dependency management |
| Monorepo Tool | Turborepo | Only where adopted by the repository | Build orchestration for multi-package repositories |
| IDE | Visual Studio Code | Current supported release | Primary development environment |
| Containerization | Docker | Current supported release | Consistent environments and deployment |

Technology choices are governed architectural decisions; version changes do not by themselves change the architecture.

## Frontend Technologies

### Flutter

Flutter is the selected cross-platform UI framework.

Responsibilities:
- Render user interfaces.
- Handle user interaction.
- Communicate with backend APIs.
- Manage presentation/application state.
- Display backend-provided data.

Flutter is **not** the authoritative location for business rules, database access, security enforcement, or business-rule enforcement.

Supported platform targets are governed by the current product/platform requirements. Platform-specific implementations shall be isolated behind Flutter abstractions.

### Dart

Dart is the selected frontend language. Production frontend code shall use Dart.

## Backend Runtime

### Node.js

Node.js is the selected backend runtime.

Responsibilities include hosting the backend application and coordinating HTTP requests, application services, database access, jobs, and integrations.

CPU-intensive workloads that could block request processing shall use the worker/job architecture where appropriate.

## Backend Language

### TypeScript

Production backend code shall be written in TypeScript with strict type checking according to the repository's compiler configuration.

The exact compiler target/module settings are implementation concerns and shall be defined by the actual project configuration rather than duplicated as competing requirements here.

## Web Framework

### Fastify

Fastify is the selected HTTP framework.

Responsibilities include:
- REST API routing.
- HTTP request/response handling.
- Integration with authentication and authorization mechanisms.
- Request/response validation integration.
- Error handling at the API boundary.

Fastify is not the owner of domain business rules; those remain in the backend application/domain layers.

## Database

### PostgreSQL

PostgreSQL is the primary and authoritative persistence layer for ERP business data.

Authoritative database architecture includes:
- ACID transactions.
- Referential integrity.
- Constraints and indexes.
- PostgreSQL Row-Level Security for tenant isolation.
- Appropriate audit and lifecycle mechanisms.

PostgreSQL remains the system of record unless a formal architectural decision establishes otherwise.

## Object-Relational Mapping

### Drizzle ORM

Drizzle ORM is the current type-safe database access technology.

It shall be used consistently with the authoritative database architecture. Direct SQL is permitted where justified by query complexity, database capabilities, or performance requirements, while preserving database ownership and security rules.

## Validation

### Zod

Zod is the selected schema-validation technology where applicable.

Validation may be used for API contracts, DTOs, configuration, and other runtime boundaries. Backend validation remains authoritative even when the frontend performs equivalent UX validation.

## Authentication

### JWT

JWT is the selected token format for the authentication architecture.

Token issuance, validation, expiration, refresh behavior, revocation/session behavior, claims, and signing configuration shall follow the authoritative authentication/security documentation and implementation. This document does not define competing token-lifecycle rules.

Future identity capabilities such as MFA, OIDC, SAML, or device trust require explicit architectural/security decisions before becoming part of the stack.

## Development Tools

### Git

Git is the source-control system. Branching, review, and commit practices are governed by repository development workflow documentation.

### pnpm

pnpm is the selected Node.js package manager where used by the repository. The lockfile and package manifests are authoritative for dependency resolution.

### Turborepo

Turborepo may be used where the repository's actual workspace/build configuration adopts it. Documentation must not imply a monorepo capability that is absent from the implementation.

### Visual Studio Code

Visual Studio Code is the primary development environment for the project.

### Docker

Docker may be used for reproducible development and deployment environments where defined by the deployment architecture.

## Technology Governance

Core technology replacement requires appropriate architectural evaluation and, where it changes an architectural decision, an Architecture Decision Record.

The repository's actual dependency/toolchain configuration is authoritative for exact versions. This document governs technology selection and intent rather than maintaining a second version-management system.

## Technology Not Included

Alternative technologies are not part of the current stack unless explicitly adopted through the architecture governance process. Examples include alternative frontend frameworks, alternative primary databases, GraphQL as the primary API contract, and serverless as the primary backend deployment model.

## Deferred Decisions

Technologies such as message brokers, distributed caches, search engines, object-storage providers, monitoring platforms, tracing platforms, secret managers, CI/CD platforms, infrastructure-as-code tools, container orchestration, and external identity providers shall be introduced only when required and formally selected. A deferred option is not an implementation requirement.

## Summary

The technology stack provides a stable architectural foundation while allowing implementation versions and optional infrastructure capabilities to evolve through repository configuration and formal governance.

## Related Documents

- [Design Philosophy](../02-architecture/01-design-philosophy.md)
- [System Architecture](../02-architecture/02-system-architecture.md)
- [Backend Architecture](../04-backend/README.md)
- [Frontend Architecture](./README.md)
- [Database Architecture](../03-database/README.md)
- [Governance](../00-overview/02-governance.md)

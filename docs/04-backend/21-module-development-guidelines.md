# Module Development Guidelines

**Document Purpose:** Define the standard development guidelines and contracts for ERP business modules.

---

<!-- Canonical Ownership (automated reconciliation) -->
**Canonical Ownership (DECISION):**
- Canonical file (module contract): `docs/04-backend/21-module-development-guidelines.md`
- Disposition: KEEP — Module development guidelines are canonical here; modules must adhere to these contracts when integrating with platform services.

---

## 21.1 Introduction

The Enterprise ERP Platform consists of independent business modules that collectively form a unified modular-monolith application.
To ensure consistency across modules, every development team shall follow standardized module design principles.
Module consistency simplifies maintenance, onboarding, testing, and long-term evolution.

"Independent" means logically isolated in ownership and boundaries; it does not mean separately deployed services.

## 21.2 Objectives

The module guidelines aim to:
- Standardize development.
- Promote maintainability.
- Reduce duplication.
- Improve code quality.
- Support modular architecture.
- Enable future scalability.

## 21.3 Standard Module Structure

Each module shall contain the structures required by its responsibilities, following the project's established vertical-slice conventions. Where applicable, these include:
- Routes/API adapters.
- Application/services.
- Repositories/data access.
- Domain model.
- Validation.
- Events.
- DTOs/contracts.
- Tests.
- Module configuration.

Not every module is required to contain every structure when that structure is not applicable.

## 21.4 Module Responsibilities

A module owns:
- Business Rules.
- Domain Entities.
- Its authoritative Database Access.
- Module-specific Validation.
- APIs/contracts it exposes.
- Events it publishes.

A module shall not own another module's business logic.

## 21.5 Public Interfaces

Modules may expose functionality through:
- Published Application/Service Interfaces for internal module-to-module interaction.
- Events for asynchronous integration where appropriate.
- REST API Endpoints for external clients and integrations.

Internal implementation details shall remain private.

## 21.6 Dependencies

Permitted dependencies include:
- Shared Platform Infrastructure.
- Approved Shared Utilities.
- Published Module Interfaces.

Direct dependencies on another module's internal implementation are prohibited.
Cross-module writes are prohibited. Read-only cross-module data access is permitted only where explicitly justified under the database architecture, particularly for approved reporting/read-model use cases.

## 21.7 Shared Components

The following capabilities may be provided by the platform and shared:
- Authentication.
- Authorization.
- Logging.
- Notifications.
- Configuration.
- Approved Utilities.

Business rules shall not be moved into shared libraries merely to reduce duplication.

## 21.8 Module Independence

Each module should be capable of:
- Independent development.
- Independent testing.
- Independent documentation.
- Future extraction into a separately deployed service if required by a future architectural decision.

The current architecture remains a modular monolith; independent deployment is not a current requirement.

## 21.9 Documentation

Every module shall include, where applicable:
- Functional Overview.
- API Documentation.
- Domain Model.
- Events.
- Database Changes.
- Configuration.
- Test Coverage.

Documentation shall evolve alongside the module.

## 21.10 Summary

Standardized module development enables the ERP to grow in a controlled and predictable manner while preserving architectural consistency across all business domains.

---

## Cross References

- [Modular Monolith](./03-modular-monolith.md)
- [Design Philosophy](../02-architecture/01-design-philosophy.md)

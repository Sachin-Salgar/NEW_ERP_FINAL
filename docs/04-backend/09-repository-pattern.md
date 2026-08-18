# Repository Pattern

**Document Purpose:** Define the repository pattern for the Enterprise ERP Platform.

---

## 9.1 Introduction

The Repository Pattern provides an abstraction between application/domain logic and the underlying data storage mechanism.
Business services should depend on repository abstractions rather than directly depending on concrete Drizzle ORM or PostgreSQL implementation details.

The Repository Pattern supports maintainability, testability, and controlled persistence boundaries.

## 9.2 Objectives

The Repository Pattern aims to:
- Separate business/application logic from data access.
- Simplify testing.
- Promote focused data-access components.
- Support controlled persistence evolution.
- Improve maintainability.
- Standardize database operations.

## 9.3 Responsibilities

Repositories are responsible for:
- Creating records.
- Reading records.
- Updating records.
- Soft deleting records where the entity lifecycle permits it.
- Executing database queries.
- Mapping persistence models where required.
- Managing persistence concerns.

Repositories shall not contain business rules or application workflow decisions.

## 9.4 Repository Structure

Each business module shall define repositories for the data it owns.
Examples:

CustomerRepository

SupplierRepository

ProductRepository

SalesInvoiceRepository

PurchaseOrderRepository

EmployeeRepository

Every repository shall expose only operations relevant to its owning module/domain.

## 9.5 Repository Interfaces

Application services shall depend upon repository interfaces/abstractions rather than concrete implementations.

Illustrative flow:

Application Service

↓

Repository Interface

↓

Drizzle Repository

↓

PostgreSQL

This supports dependency injection and controlled testing.

## 9.6 Query Responsibilities

Repositories may perform:
- Single-record retrieval.
- List queries.
- Pagination.
- Filtering.
- Sorting.
- Aggregations required by the owning module/use case.
- Transaction participation.

Complex business decisions shall remain within the application/domain layers.

Read-only cross-module database access is permitted only under the controlled rules defined by the database architecture, such as approved reporting/read models. A module's repository must not modify data owned by another module.

## 9.7 Transactions

Repositories participate in transaction contexts initiated and coordinated by the application/service layer.
Repositories shall not independently commit or roll back a transaction unless explicitly defined as the transaction owner by the architecture.

Transaction coordination belongs to the application/service layer.

## 9.8 Testing

Repository implementations shall be verified through appropriate integration tests against the supported persistence layer.
Application services shall use controlled repository interfaces during unit testing.

## 9.9 Anti-Patterns

The following practices are prohibited:
- Business logic inside repositories.
- HTTP request handling.
- Application workflow decisions inside repositories.
- Direct controller-to-database access.
- Cross-module repository writes.
- A module using another module's repository implementation as a shortcut around its published contract.

## 9.10 Summary

Repositories provide a focused mechanism for persistent-data access while preserving application/domain logic and module ownership boundaries.

---

## Cross References

- `docs/04-backend/08-service-layer-design.md`
- `docs/04-backend/05-dependency-injection-ioc.md`
- `docs/03-database/README.md`

# Dependency Injection & Inversion of Control

Document Purpose: Chapter 5 from Volume 3 — Dependency Injection & IoC

Source: Enterprise ERP Software Architecture — Volume 3 (Chapter 5)

---

## Chapter 5

### 5.1 Introduction

As applications grow, directly creating dependencies inside classes leads to tightly coupled code that is difficult to test and maintain.

The Enterprise ERP Platform adopts Dependency Injection (DI) and Inversion of Control (IoC) to promote loose coupling, improve testability, and simplify module development.

Classes shall receive required dependencies rather than creating them internally.

### 5.2 Objectives

The dependency injection strategy aims to:
• Reduce coupling.
• Improve testing.
• Simplify maintenance.
• Promote modularity.
• Enable easier replacement of implementations.

### 5.3 Principle of Dependency Inversion

High-level business logic shall depend on abstractions rather than concrete implementations.

Example:
Service

↓

Repository Interface

↓

Repository Implementation

The service is unaware of the underlying database technology.

### 5.4 Constructor Injection

Dependencies should be provided through constructors.

Illustrative example:
CustomerService

↓

CustomerRepository

↓

Database

This makes dependencies explicit and simplifies testing.

### 5.5 Repository Interfaces

Each module shall define repository interfaces.
Example:
• CustomerRepository
• ProductRepository
• SalesInvoiceRepository

Concrete implementations using Drizzle ORM shall remain within the Infrastructure Layer.

### 5.6 Service Dependencies

Business services may depend upon:
• Repository Interfaces.
• Domain Services.
• Validation Services.
• Event Publishers.
• Configuration Providers.

Services should avoid unnecessary dependencies.

### 5.7 Dependency Lifetime

The backend shall define appropriate lifetimes for injected components.
Typical categories include:
• Singleton.
• Scoped.
• Transient.

Lifetime selection shall consider performance, thread safety, and resource usage.

### 5.8 Testing Benefits

Dependency Injection enables:
• Mock repositories.
• Mock email services.
• Mock payment gateways.
• Mock notification systems.

Unit tests can therefore execute without requiring external systems.

### 5.9 Anti-Patterns

The following practices are prohibited:
• Creating dependencies using new inside business services.
• Accessing global singletons unnecessarily.
• Circular dependencies.
• Service Locator pattern for ordinary business logic.

### 5.10 Summary

Dependency Injection provides a flexible foundation for modular backend development.
By separating interfaces from implementations, the ERP becomes easier to maintain, test, and extend.

---

Cross References

- docs/04-backend/02-clean-architecture.md
- docs/04-backend/09-repository-pattern.md

References

- Volume 3 — Backend Architecture (source)

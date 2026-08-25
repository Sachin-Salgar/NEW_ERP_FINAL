# Dependency Injection

**Document Purpose:** Define dependency-injection principles for the Flutter frontend.

## 6.1 Introduction

Dependency Injection (DI) reduces coupling by supplying objects with their required dependencies rather than allowing them to create dependencies internally.

The Flutter frontend follows the project's modular architecture and uses DI to improve modularity, maintainability, and testability.

## 6.2 Objectives

Dependency Injection aims to:
- Reduce coupling.
- Improve testing.
- Simplify maintenance.
- Enable modular development.
- Improve code reuse where appropriate.

## 6.3 Dependency Flow

A typical frontend dependency flow is:

```text
Screen / Widget
      ↓
State Management / Provider
      ↓
Application Service
      ↓
API Client
      ↓
Backend REST API
```

The exact layers used by a feature shall follow the established frontend architecture; this diagram is illustrative rather than a mandatory implementation template for every feature.

Dependencies should be expressed through stable contracts rather than unnecessary knowledge of concrete implementations.

## 6.4 Injectable Capabilities

Typical injectable capabilities may include:
- Authentication client/service.
- API client.
- Local storage abstraction.
- Notification capability.
- Logging capability.
- Configuration access.
- Navigation capability where DI is appropriate.

Only capabilities actually required by the application shall be registered. Initialization strategy shall follow the lifecycle requirements of each capability; application startup must not eagerly initialize every service by default.

## 6.5 Module Dependencies

A frontend module shall declare and use the dependencies required for its own functionality.

Module code must not reach into another module's private implementation merely to obtain a dependency. Shared platform capabilities may be consumed through approved shared interfaces.

Module independence is a logical architectural boundary within the modular application; it does not imply separate deployment or a plugin architecture.

## 6.6 Lazy Initialization

Capabilities that are expensive to construct or are not required during initial application startup may use lazy initialization.

Lazy initialization is an optimization/lifecycle choice and shall not be applied blindly where eager initialization is required for correctness.

## 6.7 Testability

Dependency Injection enables controlled test doubles for boundaries such as:
- API clients.
- Storage abstractions.
- Authentication clients.
- Notification capabilities.
- Other external dependencies.

Tests should replace external boundaries where appropriate while keeping the behavior under test real.

## 6.8 Best Practices

Developers shall:
- Inject dependencies rather than constructing infrastructure dependencies inside business/application code.
- Avoid unnecessary global mutable state.
- Prefer stable contracts/abstractions where they provide meaningful decoupling.
- Keep dependency graphs understandable.
- Prevent circular dependencies.
- Avoid using DI merely to hide unclear ownership or unnecessary abstractions.

## 6.9 Summary

Dependency Injection supports a maintainable Flutter architecture by separating dependency construction from application behavior and making feature code easier to test and evolve.

## Cross References

- [Flutter Architecture](./02-flutter-architecture.md)
- [Modular Frontend Architecture](./03-modular-frontend-architecture.md)
- [State Management](./05-state-management.md)

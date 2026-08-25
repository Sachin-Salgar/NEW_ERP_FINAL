# Project Structure

**Document Purpose:** Define the recommended Flutter repository and module project layout.

---

## 4.1 Introduction

A well-organized project structure is essential for maintaining a large-scale ERP application. The structure shall promote modularity, maintainability, scalability, and developer discoverability without turning an illustrative directory tree into an unconditional implementation requirement.

## 4.2 Objectives

The project structure aims to:
- Standardize code organization.
- Improve maintainability.
- Reduce coupling.
- Simplify onboarding.
- Support modular development.
- Enable future expansion.

## 4.3 Root Directory Structure

The Flutter application should use logical areas such as:

```text
lib/
├── app/
├── core/
├── shared/
├── modules/
├── services/
├── routing/
├── themes/
├── localization/
└── main.dart
```

The exact tree may evolve with implementation. Actual repository structure is authoritative once code exists; this document defines architectural intent.

## 4.4 Core Directory

The core area contains infrastructure shared across the application, where applicable:
- Authentication integration.
- Dependency injection.
- Networking.
- Configuration.
- Error handling.
- Logging.
- Security-related client infrastructure.
- Storage abstractions.

Business-specific module logic shall not be placed in core merely for convenience.

## 4.5 Shared Directory

The shared area contains reusable, business-independent UI components such as:
- Buttons.
- Dialogs.
- Form controls.
- Data tables.
- Charts.
- Loading indicators.
- Empty states.
- Search components.

## 4.6 Modules Directory

Each business module should reside in its own directory, for example:

```text
modules/
├── dashboard/
├── sales/
├── purchasing/
├── inventory/
├── finance/
├── hr/
├── payroll/
└── crm/
```

The example list is illustrative, not an assertion that every module is implemented or enabled.

## 4.7 Module Internal Structure

A module may use a structure such as:

```text
sales/
├── screens/
├── widgets/
├── state/
├── models/
├── services/
├── routes/
├── validators/
├── assets/
└── tests/
```

The actual directories should correspond to the module's responsibilities and the selected state-management and routing patterns.

## 4.8 Architectural Rules

- Module code belongs within its owning module unless it is genuinely shared infrastructure or business-independent UI.
- Shared code must not become a dumping ground for module-specific business logic.
- Modules must not reach into another module's private implementation.
- Frontend code must not become the authoritative business-rule or authorization boundary.
- Cross-module behavior must use approved frontend/application contracts and backend APIs.

## 4.9 Summary

The project structure provides a consistent organizational foundation for the Flutter application while allowing implementation details to evolve without changing module ownership or architectural boundaries.

## Related Documents

- [Frontend Overview](./01-frontend-overview.md)
- [Flutter Architecture](./02-flutter-architecture.md)
- [Modular Frontend Architecture](./03-modular-frontend-architecture.md)
- [State Management](./05-state-management.md)
- [Backend Module Development Guidelines](../04-backend/21-module-development-guidelines.md)

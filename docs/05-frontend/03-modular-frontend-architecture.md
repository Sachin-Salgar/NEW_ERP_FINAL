# Modular Frontend Architecture

**Document Purpose:** Define modular architecture and module boundaries for the Flutter frontend.

---

## 3.1 Introduction

The frontend follows the same business-module boundaries as the backend while remaining part of the single Flutter application.

Each ERP module owns its frontend implementation and integrates with approved shared/platform capabilities. Frontend module independence means logical isolation and ownership; it does not imply separately deployed frontend applications.

## 3.2 Objectives

The modular frontend architecture aims to:
- Improve maintainability.
- Enable independent module development.
- Reduce coupling.
- Simplify testing.
- Support future expansion.
- Align frontend boundaries with backend business modules.

## 3.3 Module Structure

A module may contain structures appropriate to its responsibilities, such as:

```text
module/
├── screens/
├── widgets/
├── models/
├── services/
├── state/
├── routes/
├── assets/
└── tests/
```

Not every module must contain every directory. The implementation should reflect actual module responsibilities.

## 3.4 Example Modules

Examples include Dashboard, CRM, Sales, Purchasing, Inventory, Manufacturing, Finance, HR, Payroll, Reports, and Administration.

The actual enabled module set is a product/organization decision and must not be inferred solely from this example list.

## 3.5 Shared Components

The frontend may provide shared, business-independent components such as:
- Buttons.
- Data tables.
- Dialogs.
- Date pickers.
- Navigation components.
- Charts.
- Form controls.
- Loading indicators.

Shared components must not become a location for unrelated business rules merely to reduce duplication.

## 3.6 Module Independence

A module owns its:
- Routes.
- UI.
- Frontend state.
- Module-specific services.
- Assets.

Modules shall not directly depend on another module's internal implementation. Cross-module interaction must use approved contracts/capabilities rather than reaching into another module's private state or implementation.

## 3.7 Feature Availability

Module enablement/licensing and user authorization are separate concerns.

The frontend may use backend-provided organization/module availability and user permissions to determine what the user may see and access. The frontend must not treat visibility as the security boundary; the backend independently enforces authorization.

Illustrative flow:

```text
User Authentication
        ↓
Backend establishes organization/user context
        ↓
Frontend obtains available modules and permissions
        ↓
Frontend presents authorized UI
        ↓
Backend enforces authorization on every protected operation
```

## 3.8 Future Extensions

The modular design should avoid preventing future extensions or separately packaged capabilities, but plugin/marketplace architecture is not a current requirement unless formally adopted.

## 3.9 Summary

The modular frontend mirrors business-domain boundaries while remaining part of the current unified Flutter application. Clear ownership, private implementation boundaries, and backend-enforced authorization allow modules to evolve independently without creating accidental coupling.

## Related Documents

- [Frontend Overview](./01-frontend-overview.md)
- [Flutter Architecture](./02-flutter-architecture.md)
- [Project Structure](./04-project-structure.md)
- [Backend Module Development Guidelines](../04-backend/21-module-development-guidelines.md)
- [Backend Architecture](../04-backend/README.md)

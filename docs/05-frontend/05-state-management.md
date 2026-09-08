# State Management (Provider / ChangeNotifier)

**Document Purpose:** Define frontend state-management principles and the selected Provider/ChangeNotifier approach for the Flutter application.

---

## 5.1 Introduction

State management coordinates information between the user interface, frontend application workflows, and backend services.

The Enterprise ERP Platform currently adopts **Provider with ChangeNotifier**, with **GetIt** used for dependency registration and service lookup.

This document describes the architecture that is actually implemented in the repository. A future migration to Riverpod may be considered separately, but Riverpod is not the current selected implementation.

## 5.2 Why Provider / ChangeNotifier?

Provider/ChangeNotifier is currently selected because it provides:
- Straightforward integration with Flutter widgets.
- Explicit state ownership through `ChangeNotifier` classes.
- Low migration overhead for the current frontend.
- Familiar dependency injection patterns when combined with GetIt.
- Testable service/controller boundaries.

## 5.3 Objectives

The state-management strategy aims to:
- Keep UI state understandable.
- Reduce widget complexity.
- Support modular development.
- Improve testability.
- Keep service dependencies explicit.
- Avoid unintended side effects.

## 5.4 Types of State

The application may manage several categories of state.

**Application State**
- Authentication/session context.
- Current user context.
- Theme.
- Tenant context and branch authorization state.
- Frontend representation of permissions/availability.

**Screen State**
- Form values.
- Selected tab.
- Search filters.
- Sorting.

**Module State**
- Module dashboards.
- Lists and filters.
- Workflow presentation state.
- Approval UI state.

**Temporary UI State**
- Dialog visibility.
- Loading indicators.
- Selected rows.
- Expanded panels.

Frontend state is not the authoritative system of record for ERP business data.

## 5.5 Provider Organization

`ChangeNotifier` controllers/services should be organized according to application or module ownership.

A module should expose the state needed by its own screens without directly depending on another module's private state implementation.

Shared state is appropriate for genuinely shared platform/application concerns such as authentication context, theme, tenant context, and service registrations.

GetIt is used for dependency registration and lookup where the implementation requires service-level dependencies rather than widget-scoped state.

## 5.6 State Updates

State changes shall be:
- Predictable.
- Explicit.
- Testable.
- Immutable where practical.
- Free from unintended side effects.

`ChangeNotifier.notifyListeners()` should be used only after a meaningful state transition.

## 5.7 Separation of Responsibilities

- Widgets focus on presentation.
- `ChangeNotifier` classes coordinate frontend state and presentation-facing workflows.
- Services/API clients communicate with backend/platform interfaces.
- GetIt manages shared service dependencies where appropriate.
- Backend application/domain layers remain authoritative for business rules.
- The backend remains authoritative for authorization and persistence.

Providers and frontend services must not bypass backend APIs to implement business operations through direct database access.

## 5.8 Authentication and Authorization State

The frontend may hold the client-side representation of authentication/session information and permissions required for UX and navigation.

Such state controls presentation only. The backend independently authenticates and authorizes protected operations.

## 5.9 Testing

ChangeNotifiers, services, and state transitions shall support independent testing without requiring Flutter UI components where practical.

Tests should verify state transitions, dependency behavior, loading/error states, and interaction with service/API abstractions.

## 5.10 Summary

Provider/ChangeNotifier is the current state-management mechanism implemented by the Flutter application, with GetIt used for dependency registration. Its use must preserve module boundaries and the fundamental rule that frontend state is not a substitute for authoritative backend business logic, authorization, or persistence.

## Related Documents

- [Flutter Architecture](./02-flutter-architecture.md)
- [Modular Frontend Architecture](./03-modular-frontend-architecture.md)
- [Project Structure](./04-project-structure.md)
- [API Communication](./09-api-communication.md)
- [Backend Authentication & Authorization](../04-backend/07-authentication-and-authorization.md)

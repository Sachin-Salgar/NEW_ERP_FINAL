# State Management (Riverpod)

**Document Purpose:** Define frontend state-management principles and the selected Riverpod approach for the Flutter application.

---

## 5.1 Introduction

State management coordinates information between the user interface, frontend application workflows, and backend services.

The Enterprise ERP Platform adopts **Riverpod** as the selected frontend state-management framework.

## 5.2 Why Riverpod?

Riverpod is selected because it provides:
- Strong typing.
- Dependency management.
- Testability.
- Low boilerplate.
- Modular organization.
- Explicit and predictable state updates.

## 5.3 Objectives

The state-management strategy aims to:
- Keep UI state understandable.
- Reduce widget complexity.
- Support modular development.
- Improve testability.
- Make dependencies explicit.
- Avoid unintended side effects.

## 5.4 Types of State

The application may manage several categories of state.

**Application State**
- Authentication/session context.
- Current user context.
- Theme.
- Organization context.
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

Providers should be organized according to application/module ownership.

A module should expose the state needed by its own screens without directly depending on another module's private providers.

Shared providers are appropriate for genuinely shared platform/application concerns such as authentication context or organization context.

## 5.6 State Updates

State changes shall be:
- Predictable.
- Explicit.
- Testable.
- Immutable where practical.
- Free from unintended side effects.

## 5.7 Separation of Responsibilities

- Widgets focus on presentation.
- Providers manage frontend state and coordination.
- Services/API clients communicate with backend/platform interfaces.
- Backend application/domain layers remain authoritative for business rules.
- The backend remains authoritative for authorization and persistence.

Providers must not bypass backend APIs to implement business operations through direct database access.

## 5.8 Authentication and Authorization State

The frontend may hold the client-side representation of authentication/session information and permissions required for UX and navigation.

Such state controls presentation only. The backend independently authenticates and authorizes protected operations.

## 5.9 Testing

Providers and state transitions shall support independent testing without requiring Flutter UI components where practical.

Tests should verify state transitions, dependency behavior, loading/error states, and interaction with service/API abstractions.

## 5.10 Summary

Riverpod provides the selected state-management mechanism for the Flutter application. Its use must preserve module boundaries and the fundamental rule that frontend state is not a substitute for authoritative backend business logic, authorization, or persistence.

## Related Documents

- [Flutter Architecture](./02-flutter-architecture.md)
- [Modular Frontend Architecture](./03-modular-frontend-architecture.md)
- [Project Structure](./04-project-structure.md)
- [API Communication](./09-api-communication.md)
- [Backend Authentication & Authorization](../04-backend/07-authentication-and-authorization.md)

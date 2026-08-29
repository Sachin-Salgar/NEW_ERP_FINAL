# Navigation Architecture

**Document Purpose:** Define navigation principles and entry points for the Enterprise ERP frontend.

## 7.1 Introduction

Navigation is the primary mechanism through which users move between dashboards, master data, transactions, reports, settings, and administration capabilities.

The navigation architecture shall provide a consistent, predictable, accessible, and efficient experience while supporting the modular ERP architecture.

Navigation may adapt to the authenticated user's organization context, enabled modules, roles, and permissions. These client-side navigation decisions are for user experience; backend authorization remains authoritative.

## 7.2 Objectives

The navigation architecture aims to:
- Provide intuitive navigation.
- Support modular applications.
- Improve user productivity.
- Reduce navigation complexity.
- Support permission-aware menus.
- Enable future module expansion.

## 7.3 Navigation Principles

Navigation shall follow these principles:
- Consistency.
- Simplicity.
- Predictability.
- Minimal unnecessary interaction.
- Context awareness.
- Accessibility.
- Keyboard navigation support where the target platform supports it.

The same navigation patterns should be reused throughout the application where they improve consistency.

## 7.4 Navigation Levels

The ERP may use multiple navigation levels:

```text
Application
    ↓
Module
    ↓
Feature
    ↓
Screen
    ↓
Dialog
```

The exact hierarchy may vary by feature and platform.

## 7.5 Main Navigation

The primary navigation may include:
- Dashboard.
- Favorites.
- Enabled Business Modules.
- Reports.
- Administration.
- User Profile.
- Notifications.

Only capabilities appropriate to the current organization and user should be presented as available. Hiding a navigation item is not a security control.

## 7.6 Dynamic Navigation

A typical navigation-loading flow is:

```text
Authenticate User
      ↓
Load Organization Context
      ↓
Load Enabled Modules / Capabilities
      ↓
Load Applicable Permissions
      ↓
Build Navigation Model
      ↓
Display Application
```

The exact data-loading sequence is an implementation concern. The backend remains responsible for enforcing authorization regardless of what the client displays.

## 7.7 Web Routing Contract

On Flutter Web, browser URL state and in-app navigation shall represent the same navigation state.

The application shall use Flutter Router APIs (`MaterialApp.router`) with a repository-owned route parser/delegate rather than relying on a route-only `MaterialApp` configuration. This provides a canonical bridge between:

```text
Browser URL
    ↕
Route configuration
    ↕
Content navigator
```

The authenticated application shell is persistent. Route changes replace/change only the content area; sidebar, top bar, profile controls, and responsive navigation remain mounted.

The routing contract shall define:

- `/login` as the unauthenticated entry point.
- `/` as a deterministic redirect/alias to `/dashboard` after authentication.
- Protected routes as authentication/permission guarded.
- Browser back/forward as first-class navigation operations.
- Unknown paths as controlled not-found states rather than generic unknown-route failures.

Route metadata is the canonical source for display title, navigation membership, module code, and frontend permission requirements. Backend authorization remains authoritative.

## 7.8 Navigation History

The application shall maintain navigation history to support:
- Back navigation.
- Forward navigation where supported.
- Recently visited screens where useful.
- Deep linking where supported by the target platform.

On Web, browser history and the application router shall remain synchronized. In-app navigation must not require a full page reload.

## 7.9 Favorites

Users may bookmark frequently used screens or capabilities where the feature supports favorites.

Examples include:
- Sales Invoice.
- Customer List.
- Stock Report.
- Payroll Approval.

Favorites shall be associated with the appropriate user and organization context so that they do not expose or reference inaccessible capabilities.

## 7.10 Breadcrumb Navigation

Complex workflows may display breadcrumb navigation.

Example:

```text
Dashboard
  > Sales
    > Sales Invoice
      > Invoice Details
```

Breadcrumbs improve orientation within deep navigation hierarchies.

## 7.11 Navigation Implementation Rules

The persistent shell shall own presentation only. It shall not recreate itself for every destination.

Navigation controls shall call the application routing coordinator rather than performing browser-level reloads. The active route shall be derived from canonical router state so sidebar selection and page titles cannot drift from the actual screen.

Permission-aware visibility and route protection shall use the same route metadata. A hidden menu item is not a substitute for route authorization.

## 7.12 Summary

A structured navigation architecture improves productivity while supporting the modular, permission-aware design of the Enterprise ERP Platform. Flutter Web routing additionally requires browser history, deep-link, shell persistence, and in-app navigation to be treated as one coherent navigation contract.

## Cross References

- [Modular Frontend Architecture](./03-modular-frontend-architecture.md)
- [Flutter Architecture](./02-flutter-architecture.md)
- [State Management](./05-state-management.md)
- [API Communication](./09-api-communication.md)
- [Frontend Navigation and Routing Implementation Plan](./24-navigation-routing-implementation-plan.md)
- [Backend Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)

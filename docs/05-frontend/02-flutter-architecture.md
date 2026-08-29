# Flutter Architecture

**Document Purpose:** Define the canonical Flutter-specific frontend architecture for the Enterprise ERP Platform.

---

## 2.1 Introduction

Flutter provides the cross-platform UI foundation for the ERP. The frontend is organized to keep presentation concerns separate from application coordination, state, API communication, and backend business rules.

## 2.2 Objectives

The Flutter architecture aims to:
- Maintain a coherent cross-platform codebase.
- Maximize appropriate code reuse.
- Enable rapid development.
- Provide consistent UX across supported platforms.
- Isolate platform-specific capabilities.
- Keep business-rule authority in the backend.

## 2.3 Layered Structure

The frontend shall use the following logical responsibilities:

Presentation

↓

Application

↓

State Management

↓

Services / API Client

↓

Backend REST API

Each layer has a defined responsibility. The exact source-code organization is governed by the project structure and module-development standards.

## 2.4 Presentation Layer

Responsibilities include:
- Screens.
- Widgets.
- Dialogs.
- Forms.
- Tables.
- Charts.
- Navigation UI.

Presentation components shall not contain authoritative business rules.

## 2.5 Application Layer

Responsibilities include:
- UI workflows.
- Screen coordination.
- User interactions.
- Navigation coordination.
- Orchestration of frontend state and services.

The application layer coordinates frontend behavior; it does not replace backend business logic.

### Web routing and shell ownership

Flutter Web uses a repository-owned Router 2.0 implementation (`MaterialApp.router`) for application navigation.

The routing boundary is split into two levels:

```text
RouterDelegate root navigator
        │
        ├── Login page (unauthenticated)
        │
        └── Persistent AppShell (authenticated)
                │
                └── Content navigator
                        │
                        └── ERP screen
```

The authenticated shell is mounted once. The content navigator changes screens without recreating the sidebar, top bar, profile controls, or responsive navigation. Browser URL/history is synchronized through the route information parser/delegate.

Navigation metadata and frontend route guards remain client-side coordination concerns; backend authorization remains authoritative.

## 2.6 State Management

State-management mechanisms are responsible for representing and coordinating frontend state. The selected framework and provider organization are defined by the state-management document.

Frontend state shall not become an alternative system of record for ERP business data.

## 2.7 Service and API Client Layer

Frontend services/API clients are responsible for communication with backend APIs and platform capabilities such as:
- Authentication interaction.
- API requests.
- File transfer.
- Local storage where required.
- Notification/platform integration.

Services shall not perform authoritative business calculations or bypass backend authorization.

## 2.8 Platform Independence

Platform-specific implementations shall be isolated behind appropriate Flutter abstractions.
Examples include:
- File selection.
- Printing.
- Camera access.
- Notifications.
- Local storage.

## 2.9 Backend Boundary

The frontend is a client of the backend. Backend APIs are authoritative for authentication, authorization, tenant/organization access, validation, business rules, financial calculations, workflows, and persistence.

Client-side validation may improve UX but must never be relied upon as the security or business-rule enforcement point.

## 2.10 Summary

Flutter provides the presentation foundation of the ERP while the layered frontend architecture maintains clear separation of UI, application coordination, state, API communication, and backend responsibilities. On Web, Router 2.0 provides the canonical bridge between browser history and the persistent authenticated shell.

## Related Documents

- [Frontend Overview](./01-frontend-overview.md)
- [Modular Frontend Architecture](./03-modular-frontend-architecture.md)
- [Navigation Architecture](./07-navigation-architecture.md)
- [Navigation and Routing Implementation Plan](./24-navigation-routing-implementation-plan.md)
- [Project Structure](./04-project-structure.md)
- [State Management](./05-state-management.md)
- [Backend Architecture](../04-backend/README.md)

# Routing Strategy

**Document Purpose:** Define routing and URL mapping principles for the Enterprise ERP frontend.

## 8.1 Introduction

Routing determines how users move between screens and how application locations are represented on supported platforms.

The routing strategy shall support the target Flutter platforms while remaining modular and maintainable.

## 8.2 Objectives

The routing strategy aims to:
- Standardize screen navigation.
- Support deep linking where the target platform supports it.
- Improve maintainability.
- Preserve module boundaries.
- Support authentication-aware navigation.
- Simplify future expansion.

## 8.3 Route Organization

Each frontend module should own the routes for its capabilities.

Examples:
- Dashboard routes.
- Sales routes.
- Inventory routes.
- Finance routes.
- HR routes.

The application router may compose these module routes into the active navigation configuration.

## 8.4 Route Registration

A typical initialization flow is:

```text
Application
    ↓
Core Routes
    ↓
Module Routes
    ↓
Navigation / Access Model
    ↓
Router Initialization
```

The implementation may use a different mechanism. Client-side route filtering is a usability mechanism; it does not replace backend authorization.

## 8.5 Route Guards

Protected routes shall handle relevant client-side state such as:
- Authentication state.
- Organization context.
- Enabled module/capability state.
- Permission information available to the client.
- Session state.

These checks improve user experience and navigation behavior. The backend must independently enforce authorization and organization/tenant isolation.

## 8.6 Deep Linking

The application should support deep links on platforms where deep linking is applicable.

Example:

```text
/sales/invoices/INV-100254
```

A deep link must not bypass authentication or backend authorization.

## 8.7 Route Parameters

Routes may accept:
- Record IDs.
- Document Numbers.
- Search Parameters.
- Filter Values.
- Report Identifiers.

Parameters shall be parsed and validated before being used by the feature.

## 8.8 Error Routes

The application should provide appropriate screens or states for:
- Page Not Found.
- Access Denied.
- Session Expired.
- Module/Capability Unavailable.

Error handling should provide a clear recovery path without exposing sensitive information.

## 8.9 Route Naming

Routes shall use descriptive, stable names or paths appropriate to the platform and routing implementation.

Examples:

```text
/dashboard
/customers
/products
/sales/invoices
/purchase/orders
/hr/employees
```

Naming conventions shall remain consistent across modules.

## 8.10 Summary

A standardized routing strategy supports maintainable, modular navigation while ensuring that client-side routing remains subordinate to backend security and authorization.

## Cross References

- [Navigation Architecture](./07-navigation-architecture.md)
- [Modular Frontend Architecture](./03-modular-frontend-architecture.md)
- [Backend Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)

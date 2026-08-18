# API Communication

**Document Purpose:** Define frontend API communication patterns, error handling, and contract expectations.

## 9.1 Introduction

The frontend communicates with the backend through the REST API.

Direct database access from the frontend is prohibited.

Authoritative business operations—including authentication, validation, reporting, approvals, and financial transactions—are executed by the backend. The frontend may perform client-side validation and presentation logic but must not become the authoritative business or security boundary.

## 9.2 Objectives

The API communication layer aims to:
- Standardize backend communication.
- Improve maintainability.
- Simplify testing.
- Support authentication.
- Handle failures consistently.
- Enable backend evolution without coupling business modules to HTTP implementation details.

## 9.3 Communication Architecture

A typical flow is:

```text
Flutter Screen
      ↓
State Management / Provider
      ↓
Application Service
      ↓
API Client
      ↓
REST API
      ↓
Backend
```

The exact layers may vary by feature, but business modules should not bypass the established API boundary.

## 9.4 API Client

A shared API client layer shall provide common HTTP concerns such as:
- HTTP Requests.
- Authentication/session integration.
- Headers.
- Timeouts.
- Error handling.
- Observability/logging where appropriate.
- Response parsing.

Business modules should not create independent HTTP infrastructure that bypasses the common client conventions.

## 9.5 Authentication

The API communication layer shall integrate with the selected authentication mechanism to:
- Supply valid authentication credentials/tokens as required.
- Handle authentication/session failures.
- Coordinate session-expiry behavior with application state.

Exact token issuance, refresh, storage, and rotation behavior is governed by the backend authentication architecture and its implementation. It shall not be invented by individual frontend modules.

## 9.6 Request Processing

An illustrative workflow is:

```text
User Action
    ↓
State Management
    ↓
Application Service
    ↓
API Client
    ↓
Backend
    ↓
Response
    ↓
State Update
    ↓
UI Refresh
```

The implementation shall preserve clear ownership of UI state, application orchestration, transport, and backend business rules.

## 9.7 Error Handling

API failures shall be represented consistently and may include:
- Network Failure.
- Authentication Failure.
- Authorization Failure.
- Validation Error.
- Business Error.
- Server Error.

The frontend shall provide useful user-facing feedback without exposing credentials, internal stack traces, or unnecessary infrastructure details.

## 9.8 Retry Strategy

Retries should be limited to failures that are safe to retry, such as suitable transient network or service failures.

Business transactions shall not be automatically retried unless the operation is explicitly designed to be safely retried, including appropriate backend idempotency semantics where required.

## 9.9 Response Caching

The frontend may cache selected responses when their freshness requirements permit it.
Examples may include:
- Organization Settings.
- Lookup Data.
- User Preferences.
- Country Lists.
- Tax Configuration.

Caching rules shall respect organization/tenant context and authorization. Transactional data requiring current state should be retrieved from the backend rather than treated as authoritative client cache data.

## 9.10 Summary

A consistent API communication layer provides reliable interaction between the Flutter application and backend while preserving the backend as the authoritative business and security boundary.

## Cross References

- [Backend API Design Standards](../04-backend/06-api-design-standards.md)
- [Backend Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)
- [Frontend State Management](./05-state-management.md)
- [Frontend Dependency Injection](./06-dependency-injection.md)

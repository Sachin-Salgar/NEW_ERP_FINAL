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

The frontend is not the authority for tenant identity. It consumes backend-issued identity and organization/tenant context and must not independently infer or hardcode a tenant for API requests. A user may be authenticated but still require a valid organization/tenant context before backend operations can proceed.

### 9.5.1 Deployment-Specific Bootstrap and Tenant Resolution
The implemented deployment model supports both SaaS and on-premises installation while keeping one Flutter client architecture.

- **SaaS**: the backend resolves the tenant from the hostname, subdomain, or custom domain before login.
- **On-premises**: the backend resolves the tenant from trusted installation/server configuration before the login flow proceeds.
- **Bootstrap**: the client connects to a backend bootstrap endpoint to obtain deployment metadata and branding without treating client configuration as proof of tenant access.
- **Session**: the backend generates the effective tenant, organization, role, permission, and location context after successful authentication.

### 9.5.2 Flutter Security Boundaries and Responsibilities

Flutter is a client and is not the security authority for tenant identity, organization authorization, role/permission evaluation, database RLS, or request context. The frontend may:

1. resolve the backend endpoint;
2. call the public bootstrap endpoint;
3. render deployment branding and login UI;
4. request authentication and receive backend-authored session state;
5. display, select, and switch among organizations the backend has authorized for the user;
6. display permitted location context after backend validation;
7. send authenticated requests using the backend-issued session/effective context.

Flutter must not:

- invent or override the tenant ID;
- treat a local value or URL parameter as authoritative tenant or organization data;
- store a user-editable `tenant_id` as a security control;
- bypass backend validation by altering headers, query parameters, local storage, or in-memory state;
- assume that frontend visibility implies authorization;
- interpret location choice as a replacement for tenant isolation.

The frontend may reflect the effective context it receives from the backend, but the backend remains the single authority for tenant resolution, organization validation, authorization, and database transaction scope.

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

### 9.6.1 Frontend Session and Organization States
The frontend may represent the following conceptual states:

- **Unauthenticated** — no valid session is present.
- **Deployment context resolved** — the client has a valid backend endpoint and the backend has resolved the tenant context for the current deployment.
- **Authenticated but tenant context unresolved** — the user is signed in but no active organization/tenant has been established for the request.
- **Authenticated with a single eligible organization** — the app may continue without an additional selector.
- **Authenticated with multiple eligible organizations** — a selection step is required before tenant-scoped operations proceed.
- **Authenticated with active organization** — backend identity and organization context are valid.
- **Authenticated with active location** — the user has selected a permitted operational location under the active organization.
- **Unauthorized organization** — the selected organization is not available to the user; access is rejected by the backend.
- **Session expired** — token/session validation fails and the app must redirect to a re-authentication flow.

These states are UI representations of backend-authoritative security context; the frontend must not infer or override organization/tenant authorization independently.

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

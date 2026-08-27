# API Communication

**Document Purpose:** Define frontend API communication patterns, error handling, session integration, and deployment endpoint configuration.

## 9.1 Introduction

The frontend communicates with the backend through the REST API. Direct database access from the frontend is prohibited.

Authoritative business operations—including authentication, tenant membership validation, authorization, validation, reporting, approvals, and financial transactions—are executed by the backend.

## 9.2 Objectives

The API communication layer aims to:
- Standardize backend communication.
- Improve maintainability.
- Simplify testing.
- Support authentication and tenant-scoped sessions.
- Handle failures consistently.
- Support SaaS and on-premises backend endpoints.
- Enable web and mobile clients to use the same backend security contract.

## 9.3 Communication Architecture

```text
Flutter Screen / Mobile Screen
      ↓
State Management / Provider
      ↓
Application Service
      ↓
API Client
      ↓
ERP Backend API
      ↓
Backend Security + Business Services
```

Business modules must not bypass the established API boundary.

## 9.4 API Client

A shared API client layer shall provide common HTTP concerns such as:
- Backend endpoint/base URL.
- Authentication/session integration.
- Headers.
- Timeouts.
- Error handling.
- Observability/logging where appropriate.
- Response parsing.

The client must not use the API endpoint as evidence of tenant authorization.

## 9.5 Authentication and Tenant Session

The frontend integrates with backend authentication to supply credentials/tokens, handle session failures, restore sessions, request tenant selection when needed, display the active tenant, and send authenticated requests.

The frontend is not the authority for tenant identity. Tenant access is established by authenticated identity and server-validated tenant membership.

### 9.5.1 Canonical Client Flow

```text
Configured Backend Endpoint
      ↓
Login
      ↓
Backend Authentication
      ↓
Tenant Memberships
      ↓
One tenant → continue
Multiple tenants → show tenant selector
      ↓
Backend validates selection
      ↓
Tenant-scoped Session
      ↓
Authenticated API requests
```

The frontend must not require hostname-based tenant discovery or deployment-specific tenant mapping.

### 9.5.2 SaaS and On-Premises Endpoint Configuration

The client needs to know where the ERP backend is located.

**SaaS:** the application normally uses the centrally hosted cloud API endpoint.

**On-premises:** the customer installation provides its backend endpoint. The web frontend and mobile application may be configured with that endpoint directly or reach it through the company LAN, approved VPN, or secured public HTTPS path according to deployment policy.

The endpoint identifies the backend deployment only. It does not identify or authorize a tenant.

### 9.5.3 Flutter Security Responsibilities

Flutter is not the security authority for tenant identity, tenant membership, organization authorization, role/permission evaluation, database RLS, or transaction tenant context.

Flutter may store the backend endpoint, authenticate, display backend-returned tenant memberships, request an authorized tenant selection, display the active tenant, and send authenticated requests.

Flutter must not invent or override tenant identity, treat a URL/local value/header as proof of tenant authorization, bypass backend membership validation, connect directly to PostgreSQL, or assume UI visibility implies authorization.

## 9.6 Request Processing

```text
User Action
    ↓
State Management
    ↓
Application Service
    ↓
API Client
    ↓
Authenticated Backend Request
    ↓
Backend TenantContext + Authorization
    ↓
Response
    ↓
State Update
    ↓
UI Refresh
```

The frontend may maintain a local representation of the active tenant for display and navigation, but the backend remains authoritative.

## 9.6.1 Frontend Session States

The frontend may represent:
- Unauthenticated.
- Authenticating.
- Authenticated, tenant selection required.
- Authenticated with active tenant.
- Authenticated with active location.
- Unauthorized tenant.
- Session expired.

These are UI states derived from backend-authoritative session information.

## 9.7 Error Handling

API failures may include network, authentication, tenant access, authorization, validation, business, and server errors. User-facing feedback must not expose credentials, stack traces, or unnecessary infrastructure details.

## 9.8 Retry Strategy

Retries should be limited to safe transient failures. Business transactions must not be automatically retried unless explicitly designed to be safely retryable.

## 9.9 Response Caching

The frontend may cache selected responses when freshness requirements permit it. Cached data must remain scoped to the authenticated tenant/session and must never become an authorization mechanism.

## 9.10 Mobile Connectivity

Mobile clients communicate only with the ERP backend API.

```text
Mobile
   ↓ HTTPS / VPN / LAN
ERP Backend
   ↓
PostgreSQL
```

PostgreSQL must never be directly exposed to the mobile application. Mobile uses the same authentication, tenant membership, tenant selection, authorization, session, and API contract as web.

## 9.11 Summary

The frontend is responsible for **where to connect**, not **which tenant the user is authorized to access**.

```text
Backend Endpoint
      ↓
Authentication
      ↓
Tenant Membership
      ↓
Active Tenant Session
      ↓
Authenticated Requests
```

Tenant isolation and authorization remain backend responsibilities, with PostgreSQL RLS providing the database enforcement boundary.

## Cross References

- [Backend API Design Standards](../04-backend/06-api-design-standards.md)
- [Backend Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)
- [Multi-Tenant Architecture](../03-database/11-multi-tenancy.md)
- [Frontend State Management](./05-state-management.md)
- [Frontend Dependency Injection](./06-dependency-injection.md)

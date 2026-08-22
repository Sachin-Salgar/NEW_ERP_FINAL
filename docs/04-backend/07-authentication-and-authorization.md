# Authentication & Authorization Flow

**Document Purpose:** Define backend authentication and authorization implementation patterns for the Enterprise ERP Platform.

---

<!-- Canonical Ownership (automated reconciliation) -->
**Canonical Ownership (DECISION):**
- Canonical file (implementation patterns): `docs/04-backend/07-authentication-and-authorization.md`
- Policy canonical: `docs/06-security/04-enterprise-security-architecture.md`
- Disposition: KEEP — backend implementation patterns are canonical here; modules should reference the backend implementation for authentication/authorization API and token strategy.

---

## 7.1 Introduction

Protecting business information is a fundamental responsibility of the ERP backend.
Every request must verify:
1. Who is making the request? (Authentication)
2. What are they allowed to do? (Authorization)

The Enterprise ERP Platform separates these responsibilities to improve security, maintainability, and flexibility.

### 7.2 Objectives

The authentication framework aims to:
- Verify user identity.
- Protect business data.
- Support secure sessions.
- Enable multi-device access.
- Prevent unauthorized operations.
- Support enterprise-grade security.

### 7.3 Authentication Overview

Authentication confirms the identity of the user.
The ERP shall support:
- Username & Password.
- Email & Password.
- Multi-Factor Authentication (future).
- Single Sign-On (future).
- OAuth Integrations (future).

Successful authentication results in the issuance of secure access credentials.

### 7.4 Token Strategy

The backend adopts:
- Short-lived Access Tokens.
- Long-lived Refresh Tokens.

Example:

User Login

↓

Access Token

+

Refresh Token

This strategy balances security and usability.

### 7.5 Authentication Flow

User Login

↓

Credential Validation

↓

User Verification

↓

Permission Loading

↓

Access Token Generation

↓

Refresh Token Generation

↓

Secure Response

Only verified users receive access credentials.

### 7.5.1 Authentication vs. Tenant Resolution

Authentication and tenant resolution are separate responsibilities. Authentication answers: "Who is this user?" Tenant resolution answers: "Which organization/tenant context is this request operating in?"

The request lifecycle is:

```text
ERP URL / Deployment Host
  ↓
Tenant Resolver (SaaS host or on-prem installation config)
  ↓
Bootstrap / deployment metadata
  ↓
Login
  ↓
Authentication
  ↓
Authenticated Identity
  ↓
ERP User
  ↓
Organization Membership Resolution
  ↓
Active Organization Resolution
  ↓
Tenant Resolution
  ↓
TenantContext
  ↓
Tenant-scoped Transaction
  ↓
SET LOCAL app.current_tenant_id
  ↓
PostgreSQL RLS
  ↓
Authorization
  ↓
Location / Plant Context
  ↓
Application / Domain Operation
```

Tenant resolution must occur before a tenant-scoped database transaction begins. The application must never start a tenant-scoped transaction and then discover the tenant after the fact. The backend is responsible for canonical identity, authorization, and tenant-context establishment; the frontend consumes the resulting session/identity/context rather than inventing tenant identity.

The ERP distinguishes:

- **Authentication Identity** — the verified caller of the request.
- **Application User** — the ERP user record associated with the identity.
- **Tenant** — the security/data-isolation boundary that owns tenant-scoped data.
- **Organization** — the business/legal unit within a tenant.
- **Organization Membership** — the relationship that grants a user access to one or more organizations within the tenant.
- **Location / Plant / Branch** — operational context under an organization; not a tenant boundary.
- **Role** — the organizationally scoped role assigned to the user.
- **Permission** — grant for a specific action or capability within an organization/tenant scope.
- **TenantContext** — the already-resolved tenant and organization scope for the current request.

A user may belong to one or multiple organizations, with different roles and permissions in each. The resolved active organization must be validated against the user's eligible memberships before the request enters a tenant-scoped database transaction. Location access is evaluated separately as an operational authorization layer and must not replace tenant isolation.

### 7.5.2 Canonical Identity, Tenant, and Organization Model

The ERP implementation contract requires the following first-class concepts to remain distinct and server-authoritative:

| Concern | Definition | Authoritative source | Notes |
|---------|------------|---------------------|-------|
| Identity | Authenticated caller identity proven by the chosen identity mechanism | Authentication service | Answers: who is the caller? |
| User | ERP user record associated with the authenticated identity | ERP user domain | Answers: which application account belongs to the caller? |
| OrganizationMembership | Relationship granting access to an organization | Membership domain | One user may have zero, one, or many memberships |
| Tenant | Primary security/data-isolation boundary | Platform security domain | Drives PostgreSQL RLS and tenant-scoped DB access |
| Organization | Business/legal entity inside a tenant | Organization domain | Not equivalent to tenant |
| Location / Plant / Branch | Operational unit inside an organization | Location domain | Not equivalent to tenant or organization |
| Role | Organization/tenant-scoped assignment | Authorization domain | Grants permission bundles |
| Permission | Allowed action or capability | Authorization domain | Enforced at the backend |
| ActiveOrganizationContext | Authorized organization selected or resolved for the current request/session | Effective context | Must be validated against memberships |
| ActiveLocationContext | Authorized operational location for current request/session | Effective context | Additional context, not a tenant boundary |
| Session / EffectiveContext | Server-authoritative context used to process the request | Auth/session domain | Contains identity, user, tenant, organization, permissions, and location context |
| TenantContext | Resolved backend security context used to open a tenant-scoped transaction | Security/database domain | Must be created before tenant-owned database work |

The backend is authoritative for this model. The frontend may display the user's resolved context, but it cannot create or override tenant, organization, membership, or permission state. A client may request an organization switch or attach a deployment hint, but the backend must validate the result and establish the effective context.

### 7.5.3 Deployment-Specific Tenant Resolution
The project architecture requires a shared authentication and authorization pipeline across SaaS and on-premises deployments.

- **SaaS**: resolve tenant from verified host, custom domain, or subdomain before authentication.
- **On-premises**: resolve tenant from trusted installation/server configuration before authentication.
- **Bootstrap**: a non-sensitive bootstrap endpoint provides deployment metadata and branding before the login flow continues.
- **Frontend**: stores the backend endpoint and bootstrap state, but does not edit or assert tenant identity as an independent authority.

This preserves the project’s tenant-before-login foundation while separating deployment-specific tenant resolution from the authentication process itself.

### 7.6 Authorization (RBAC)

After authentication, every request undergoes authorization.
The ERP implements Role-Based Access Control (RBAC).

Illustrative hierarchy:

Organization

↓

Role

↓

Permission

↓

User

Permissions determine which operations a user may perform.

### 7.7 Permission Evaluation

Before executing any business operation, the backend verifies:
- Organization Membership.
- Active Status.
- Assigned Role.
- Module Access.
- Permission.
- Branch Restrictions (where applicable).

Access is denied if any required condition fails.

### 7.8 Module-Level Security

Since the ERP is modular, authorization operates at the module level.

Users shall only access modules that are both **enabled/licensed for their organization** and **authorized for the user**.

Module activation and user authorization are separate controls:

Organization Module Configuration

↓

Is the module enabled for the organization?

↓ yes

User Organization Membership

↓

Role / Permission Evaluation

↓

Allow or Deny

Example:

| User | Finance | HR | Inventory |
|---|---:|---:|---:|
| Accountant | ✓ | ✗ | ✓ |
| HR Manager | ✗ | ✓ | ✗ |
| Administrator | ✓ | ✓ | ✓ |

A user cannot access a module that is not enabled for the organization, even if the user's role otherwise grants permission.

### 7.8.1 Tenant and Organization Context

Authorization must evaluate access within the authenticated user's organization/tenant context. This context is resolved centrally before any tenant-scoped transaction begins. Database-level tenant isolation remains enforced independently through PostgreSQL Row-Level Security as defined by the database architecture.

The tenant-resolution step is a platform/security responsibility, not a business-module concern. Business modules must not independently query or infer tenant scope as part of routine domain logic. The canonical architecture is:

```text
Authenticated Identity
  → determine eligible organization memberships
  → determine active organization/tenant context
  → validate membership / access
  → resolve active location access if relevant
  → produce TenantContext
  → begin tenant-scoped transaction
```

Tenant resolution is not equivalent to authentication. During normal login, the client does not supply a tenant ID for authorization decisions. The backend resolves it from deployment state and validates the user’s membership before generating the effective session context. A request without a valid tenant context must fail closed rather than defaulting to another tenant or a hardcoded tenant identifier.

### 7.9 Audit Requirements

Security-related events shall be audited.
Examples:
- Successful Login.
- Failed Login.
- Password Change.
- Permission Update.
- Session Revocation.
- Token Refresh.

These events support compliance and security investigations.

### 7.10 Session Management

The backend shall support:
- Secure Logout.
- Token Revocation.
- Session Expiration.
- Concurrent Session Management.
- Device Tracking (future).

Inactive sessions shall expire automatically.

### 7.11 Summary

Authentication confirms identity while authorization controls access.
Together they provide the security foundation upon which every ERP module operates.

---

## Cross References

- `docs/06-security/01-backend-security.md`
- `docs/06-security/04-enterprise-security-architecture.md`
- `docs/04-backend/01-backend-overview.md`

# Core Enterprise Modules

**Status:** Current business-module architecture
**Scope:** Tenant, branch, identity, role, permission, and RBAC capabilities

## Purpose

This document defines the functional responsibilities of the core enterprise modules. Security policy and backend authentication implementation remain governed by their canonical security and backend documents.

## Domain Model Relationships

The authoritative business-domain model for the ERP is:

```text
Platform
  └── Tenant
       ├── Legal / Business Identity
       ├── Tax Registrations
       ├── Branches
       ├── Users / Memberships
       └── Business Transactions
```

This model preserves the separation between:

- **Tenant** — ERP account, data-isolation, membership, and security boundary.
- **Branch** — operational/statutory subdivision directly under the tenant.
- **User** — ERP account identity associated with an authenticated identity.
- **Membership** — the authorization bridge proving the user belongs to the tenant.
- **Branch access** — domain authorization to operate within a branch where required.

Branch is not a tenant or RLS boundary. Tenant remains the RLS and authorization boundary.

## 1. Tenant Management

The Tenant Management capability provides the account foundation for the ERP and the context in which business modules operate.

### Core responsibilities
- Tenant registration and profile management.
- Tenant status/lifecycle management.
- Tenant-wide configuration and preferences.
- Tenant branding and regional settings.
- Tax and financial-year configuration.
- Module activation/configuration.
- Auditable administrative changes.

Typical tenant data includes legal/display name, registration and tax identifiers, industry/business category, contact information, default currency, language, and time zone.

Lifecycle examples such as registration, configuration, active, suspended, and archived are illustrative; exact transitions are governed by implemented business rules.

## 2. Branch Management

A branch belongs directly to exactly one tenant and provides operational context for business execution. Warehouses and other physical locations remain bounded inventory concepts rather than architecture levels.

### Core responsibilities
- Branch profile and lifecycle management.
- Branch-specific operational configuration.
- Warehouse assignment.
- Working-day and holiday configuration.
- Local tax/financial settings where applicable.
- Multi-branch reporting and operational support.
- User branch authorization and validation.

Branch settings may override tenant defaults only where the applicable configuration contract permits it. A branch is not a database-isolation boundary and does not replace tenant-scoped RLS.

## 3. User & Identity Management

The User & Identity Management capability manages ERP user identities and account lifecycle in coordination with the centralized authentication and authorization architecture.

### Core responsibilities
- User profile and tenant association.
- Account lifecycle management.
- User preferences.
- Tenant membership and branch authorization assignment.
- Login/security-event history where supported.
- Integration with authorization, audit, notification, and workflow capabilities.

Authentication mechanisms are governed by the canonical backend authentication/security architecture. This module must not independently introduce alternative authentication protocols or credential storage rules.

Sensitive authentication material shall be handled according to the security architecture and shall not be stored as ordinary profile data.

A normal application user belongs to one tenant. Tenant membership is established automatically at login, and branch authorization is evaluated only where a business operation requires branch distinction.

## 4. Role Management

Roles group responsibilities and permissions for manageable authorization administration.

### Core responsibilities
- Create and maintain roles.
- Assign permissions to roles.
- Assign roles to users.
- Support tenant-scoped roles and branch authorization where required.
- Support lifecycle and audit history.
- Review role usage.

Example role names are organizational conventions, not mandatory global roles.

A role hierarchy does not imply unrestricted inheritance. Effective authorization must follow the canonical authorization rules and evaluate the authenticated tenant and any required branch authorization.

## 5. Permission Management

Permissions represent fine-grained actions that may be evaluated by the authorization system.

Permissions may be associated with:
- Modules.
- Features.
- Actions.
- Reports.
- Administrative capabilities.
- Other explicitly protected application capabilities.

Common actions may include view, create, edit, delete, approve, reject, export, print, import, configure, and execute. The actual permission vocabulary is defined by the authorization implementation.

Every protected backend operation must enforce authorization. Frontend visibility is a usability feature and is not a security boundary.

## 6. Role-Based Access Control

RBAC is the primary role/permission model for business authorization unless an approved architecture decision establishes an extension.

Effective access may depend on:
- User identity.
- Assigned roles and permissions.
- Tenant context.
- Branch scope.
- Record ownership.
- Business rules.
- Workflow state.

Data scope is distinct from screen/module visibility.

### Illustrative authorization flow

```text
Tenant Resolver / Deployment Context
      ↓
User Authentication
      ↓
Identity / Role Resolution
      ↓
Tenant Membership Resolution
      ↓
TenantContext
      ↓
Permission Evaluation
      ↓
Branch Authorization Resolution
      ↓
Business Authorization
      ↓
Authorized Operation
      ↓
Audit where required
```

The exact implementation flow is governed by the backend authorization architecture. A user cannot access tenant data or a branch-scoped operation unless the backend validates membership and authorization state.

## 7. Module Visibility and Licensing

The frontend may use tenant configuration, enabled capabilities, and effective permissions to determine which modules and features to display.

This does **not** replace backend authorization.

A tenant may be configured with only selected business capabilities/modules. The module architecture therefore supports capability-based enablement without requiring unrelated modules to be exposed to that tenant.

## 8. Data Ownership

Core enterprise modules must respect ownership boundaries established by the modular-monolith architecture.

Modules must not directly access another module's private persistence implementation. Cross-module interaction must use published contracts or explicitly approved platform mechanisms.

## Cross References

- [Business Modules Architecture](./01-business-modules-architecture.md)
- [Backend Authentication & Authorization](../04-backend/07-authentication-and-authorization.md)
- [Enterprise Security Architecture](../06-security/04-enterprise-security-architecture.md)
- [Frontend Security](../06-security/02-frontend-security.md)

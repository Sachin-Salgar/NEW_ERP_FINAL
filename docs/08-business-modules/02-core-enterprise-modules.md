# Core Enterprise Modules

**Status:** Current business-module architecture
**Scope:** Organization, branch, identity, role, permission, and RBAC capabilities

## Purpose

This document defines the functional responsibilities of the core enterprise modules. Security policy and backend authentication implementation remain governed by their canonical security and backend documents.

## 1. Organization Management

The Organization Management Module provides the organizational foundation for the ERP and the tenant context in which business modules operate.

### Core responsibilities
- Organization registration and profile management.
- Organization status/lifecycle management.
- Organization-level configuration and preferences.
- Organization branding and regional settings.
- Tax and financial-year configuration.
- Module activation/configuration.
- Auditable administrative changes.

Typical organization data includes legal/display name, registration and tax identifiers, industry/business category, contact information, default currency, language, and time zone.

Lifecycle examples such as registration, configuration, active, suspended, and archived are illustrative; exact transitions are governed by implemented business rules.

## 2. Branch Management

A branch belongs to exactly one organization and provides a location-level operational context.

### Core responsibilities
- Branch profile and lifecycle management.
- Branch-specific operational configuration.
- Warehouse assignment.
- Working-day and holiday configuration.
- Local tax/financial settings where applicable.
- Multi-branch reporting and operational support.

Branch settings may override organization defaults only where the applicable configuration contract permits it.

## 3. User & Identity Management

The User & Identity Management capability manages ERP user identities and account lifecycle in coordination with the centralized authentication and authorization architecture.

### Core responsibilities
- User profile and organizational association.
- Account lifecycle management.
- User preferences.
- Branch/organizational assignment.
- Login/security-event history where supported.
- Integration with authorization, audit, notification, and workflow capabilities.

Authentication mechanisms are governed by the canonical backend authentication/security architecture. This module must not independently introduce alternative authentication protocols or credential storage rules.

Sensitive authentication material shall be handled according to the security architecture and shall not be stored as ordinary profile data.

## 4. Role Management

Roles group responsibilities and permissions for manageable authorization administration.

### Core responsibilities
- Create and maintain roles.
- Assign permissions to roles.
- Assign roles to users.
- Support organization/branch-scoped assignments where required.
- Support lifecycle and audit history.
- Review role usage.

Example role names are organizational conventions, not mandatory global roles.

A role hierarchy does not imply unrestricted inheritance. Effective authorization must follow the canonical authorization rules.

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
- Organization/tenant context.
- Branch or other organizational scope.
- Record ownership.
- Business rules.
- Workflow state.

Data scope is distinct from screen/module visibility.

### Illustrative authorization flow

```text
User Authentication
      ↓
Identity / Role Resolution
      ↓
Permission Evaluation
      ↓
Organization / Scope Evaluation
      ↓
Business Authorization
      ↓
Authorized Operation
      ↓
Audit where required
```

The exact implementation flow is governed by the backend authorization architecture.

## 7. Module Visibility and Licensing

The frontend may use organization configuration, enabled capabilities, and effective permissions to determine which modules and features to display.

This does **not** replace backend authorization.

A customer may be configured with only selected business capabilities/modules. The module architecture therefore supports capability-based enablement without requiring unrelated modules to be exposed to that organization.

## 8. Data Ownership

Core enterprise modules must respect ownership boundaries established by the modular-monolith architecture.

Modules must not directly access another module's private persistence implementation. Cross-module interaction must use published contracts or explicitly approved platform mechanisms.

## Cross References

- [Business Modules Architecture](./01-business-modules-architecture.md)
- [Backend Authentication & Authorization](../04-backend/07-authentication-and-authorization.md)
- [Enterprise Security Architecture](../06-security/04-enterprise-security-architecture.md)
- [Frontend Security](../06-security/02-frontend-security.md)

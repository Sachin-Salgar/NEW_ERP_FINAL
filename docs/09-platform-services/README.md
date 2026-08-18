# Platform Services Architecture

This directory contains the design and standards for platform-wide services that business modules depend on.

## Platform Services Overview

The ERP provides platform-wide capabilities for cross-cutting concerns:

| Service | Purpose | Ownership |
|---------|---------|-----------|
| **Authentication Service** | User authentication, token lifecycle, session management | Platform Team |
| **Authorization Service** | Centralized authorization and permission evaluation | Platform Team |
| **Audit Service** | Audit event logging and compliance logging | Platform Team |
| **Notification Service** | User notifications, alerts, and escalations | Platform Team |
| **File Storage Service** | Document and file storage | Platform Team |
| **Configuration Service** | Organization and system configuration | Platform Team |
| **Scheduler Service** | Background and scheduled jobs | Platform Team |
| **Reporting Service** | Report execution, scheduling, and distribution | Platform Team |

## Design Principle: Platform Before Features

Platform stability is more important than rapid feature development. Cross-cutting capabilities such as Authentication, Authorization, Audit, Notifications, File Storage, Configuration, Scheduling, and Reporting shall be provided through approved platform contracts rather than reimplemented independently inside business modules.

Business modules must not implement their own:
- Authentication
- Authorization policy enforcement
- Audit logging
- Notification delivery
- File storage
- Shared configuration management
- Shared scheduling infrastructure

## Authentication Service

**Responsibilities**:
- User authentication
- Access-token generation and validation
- Refresh-token lifecycle where applicable
- Session management
- Logout/session invalidation

**Scope**:
- Provides the authentication capability consumed by the backend.
- Integrates with the authoritative identity model and configured identity providers.
- Exact external identity-provider integrations remain subject to the security architecture and approved ADRs.

**Future/optional capabilities** may include MFA, OIDC/SAML, device trust, and SSO when approved.

## Authorization Service

**Responsibilities**:
- Centralized policy evaluation
- Role and permission management
- User-to-role assignment
- Fine-grained authorization
- Segregation-of-duties controls where applicable

**Current policy baseline**:
- RBAC is the current baseline authorization model.
- The enterprise security architecture defines the enforcement architecture; business modules must not independently make authorization decisions.
- Resource/action permissions use the canonical permission model defined by the security documentation.

Future authorization models require an approved architectural decision before implementation.

## Audit Service

**Responsibilities**:
- Record audit events
- Maintain the audit trail
- Provide audit-log retrieval
- Support compliance reporting

Audit coverage includes authentication events, record changes, approvals, permission changes, privileged access, failed authorization, sensitive data access, configuration changes, and module licensing changes as required by the security architecture.

Audit records include actor, tenant/organization context, timestamp, operation, resource, result, correlation ID, and other fields required by the authoritative audit schema.

## Notification Service

**Responsibilities**:
- Send user notifications
- Manage notification preferences
- Handle notification delivery
- Support approved delivery channels

Initial channels and future channels are implementation decisions governed by the platform/service specifications and ADRs.

## File Storage Service

**Responsibilities**:
- Store documents and files
- Manage file versions
- Retrieve files
- Apply access control
- Support retention/deletion policies

Storage may support on-premises or cloud backends as defined by the deployment and storage architecture. Tenant isolation and encryption requirements are governed by the security and database documentation.

## Configuration Service

**Responsibilities**:
- Store organization/system configuration
- Provide configuration retrieval
- Manage configuration changes
- Support defined configuration scopes

Configuration ownership and precedence must be defined by the relevant module/platform specification before implementation.

## Scheduler Service

**Responsibilities**:
- Execute scheduled jobs
- Manage schedules
- Maintain execution history
- Handle retries and failures
- Expose job health/monitoring information

Business modules may register jobs through the approved scheduler contract; they must not create independent scheduling infrastructure.

## Reporting Service

**Responsibilities**:
- Execute approved reports
- Manage report definitions
- Schedule report runs
- Deliver report output
- Maintain report history where required

Report formats and delivery mechanisms are subject to the reporting specification and relevant ADRs.

## Deployment and Versioning

Platform services are **logical platform capabilities within the current modular-monolith backend**, not independently deployed services by default.

Platform capabilities may expose versioned contracts where an API contract requires versioning. Independent deployment or service extraction is a future architectural change and requires an approved ADR.

## Module Dependency on Platform Services

```text
Business Modules
       ↓
Published Platform Contracts
       ↓
Platform Capabilities
```

Modules use platform capabilities for cross-cutting concerns rather than implementing duplicate infrastructure.

## Related Documentation

- [Architectural Principles](../00-overview/01-architectural-principles.md) — Platform Before Features principle
- [Design Philosophy](../02-architecture/01-design-philosophy.md) — Platform First philosophy
- [Architectural Boundaries](../02-architecture/03-boundaries.md) — Module/platform dependency rules
- [Security Architecture](../06-security/04-enterprise-security-architecture.md) — Authentication and authorization architecture
- [Backend Modular Monolith](../04-backend/03-modular-monolith.md) — Current deployment model

## Status

This document defines current platform capability boundaries. Detailed service specifications should be added under this directory as each platform capability is designed and approved.

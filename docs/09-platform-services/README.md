# Platform Services Architecture

This directory contains the design and standards for platform-wide services that all business modules depend on.

## From Volume 1

### Platform Services Overview

In addition to business modules, the ERP provides platform-wide services:

| Service | Purpose | Ownership | All Modules Use |
|---------|---------|-----------|-----------------|
| **Authentication Service** | User login, token generation, session management | Platform Team | Yes |
| **Authorization Service** | Permission checking, role-based access control | Platform Team | Yes |
| **Audit Service** | Audit event logging, compliance logging | Platform Team | Yes |
| **Notification Service** | User notifications, alerts, escalations | Platform Team | Yes |
| **File Storage Service** | Document management, file uploads/downloads | Platform Team | Yes |
| **Configuration Service** | Organization settings, system configuration | Platform Team | Yes |
| **Scheduler Service** | Background jobs, scheduled tasks | Platform Team | Yes |
| **Reporting Service** | Report engine, report scheduling, distribution | Platform Team | Yes |

### Design Principle: Platform Before Features

**Statement**: Platform stability is more important than rapid feature development. Infrastructure such as Authentication, Authorization, Logging, Notifications, and Reporting Infrastructure shall exist before dependent modules are developed.

**Consequence**: Business modules must not implement their own:
- Authentication (use Auth Service)
- Audit logging (use Audit Service)
- Notifications (use Notification Service)
- File storage (use File Storage Service)
- Configuration (use Configuration Service)
- Scheduling (use Scheduler Service)

Sharing these services ensures consistency and centralized governance.

### Authentication Service

**Responsibilities**:
- User login (username/password validation)
- JWT token generation
- Token validation
- Refresh token management
- Session management
- Logout and token blacklist

**Scope**:
- Handles JWT token lifecycle
- Integrates with organization and user databases
- Provides tokens consumed by all modules

**Future Enhancements**:
- Multi-factor authentication (MFA)
- OIDC/SAML integration
- Device trust and registration
- Biometric authentication
- SSO support

### Authorization Service

**Responsibilities**:
- Role definition and management
- Permission definition
- User-to-role assignment
- Permission checking
- Fine-grained authorization
- Segregation of duties

**Scope**:
- Manages roles and permissions across all modules
- Provides permission checking APIs
- Organization-specific role configuration

**Permission Model**:
- Resource-based: `module:resource:action`
- Example: `sales:orders:create`, `accounting:ledger:post`
- Hierarchical where applicable

### Audit Service

**Responsibilities**:
- Record audit events
- Maintain immutable audit log
- Provide audit log retrieval
- Compliance reporting

**Audit Coverage**:
- User login/logout
- Record creation, update, deletion
- Approval/rejection
- Permission grants/revocations
- Privileged access
- Failed authorization attempts
- Sensitive data access
- Configuration changes
- Module licensing changes

**Audit Record Contents**:
- Actor (user, system, service)
- Tenant (organization)
- Timestamp
- Operation (create, update, delete, approve, etc.)
- Resource affected
- Before/after values
- Result (success/failure)
- Correlation ID
- IP address

### Notification Service

**Responsibilities**:
- Send user notifications
- Manage notification preferences
- Handle notification delivery
- Support multiple channels (in-app, email, SMS, future)

**Scope**:
- Notifications for approvals pending
- Alerts for thresholds exceeded
- Reminders for tasks
- System notifications

**Future Channels**:
- In-app notifications
- Email
- SMS
- Push notifications
- Mobile app alerts
- Slack/Teams integration

### File Storage Service

**Responsibilities**:
- Store documents and files
- Manage file versioning
- File retrieval and download
- File deletion and archival
- Access control

**Scope**:
- ERP documents (invoices, POs, receipts)
- Attachments
- Master file imports
- Report exports
- Configuration backups

**Storage Strategy**:
- Supports both on-premises (local disk) and cloud (S3, Azure Blob)
- Tenant-isolated storage
- Encryption at rest (if required)
- Backup integration

### Configuration Service

**Responsibilities**:
- Store organization settings
- Provide configuration retrieval
- Manage configuration updates
- Handle different config levels (system, organization, user)

**Configuration Types**:
- Organization settings (name, logo, address)
- Financial year definitions
- Tax settings
- Branch definitions
- Number series
- Approval workflows
- Module-specific configuration

**Scope**:
- Organization-wide settings
- Tenant-specific configuration
- User preferences

### Scheduler Service

**Responsibilities**:
- Execute scheduled jobs
- Manage job scheduling
- Provide job execution history
- Handle job retries
- Monitor job health

**Scheduled Jobs**:
- Monthly financial closing
- Daily inventory valuation
- Payroll processing
- Report generation
- Data cleanup and archival
- Backup procedures

**Features**:
- Cron-based scheduling
- One-time scheduling
- Retry logic for failures
- Execution history
- Job monitoring

### Reporting Service

**Responsibilities**:
- Execute reports
- Manage report definitions
- Schedule report runs
- Deliver reports
- Archive reports

**Report Types**:
- Standard reports (pre-built)
- Organization-configured reports
- Ad-hoc queries
- Export formats (PDF, Excel, CSV)

**Delivery**:
- On-demand execution
- Scheduled delivery (email)
- Report archive

---

## Platform Service Versioning

Platform services are independently versioned:

| Service | Version | Update Cycle |
|---------|---------|--------------|
| Authentication | v1, v2, ... | Quarterly |
| Authorization | v1, v2, ... | Quarterly |
| Audit | v1, v2, ... | Quarterly |
| Others | v1, v2, ... | Quarterly |

**Policy**: Support N-1 versions to allow gradual migration.

---

## Module Dependency on Platform Services

```
Sales Module
Inventory Module
Accounting Module
HR Module
Manufacturing Module
    ↓ (all depend on)
    ├── Authentication Service
    ├── Authorization Service
    ├── Audit Service
    ├── Notification Service
    ├── File Storage Service
    ├── Configuration Service
    ├── Scheduler Service
    └── Reporting Service
```

Modules call platform services to perform cross-cutting concerns rather than implementing duplicate functionality.

---

## Related Documentation

- [Architectural Principles](../00-overview/01-architectural-principles.md#principle-5-platform-before-features) — Platform Before Features principle
- [Design Philosophy](../02-architecture/01-design-philosophy.md#design-philosophy-1-platform-first-modules-second) — Platform First philosophy
- [Business Modules](./README.md) — How modules use platform services

## Navigation

This volume (Volume 1) establishes platform services architecture principles. Future volumes (Volume 7) will provide:
- Detailed service specifications
- Authentication architecture
- Authorization model details
- Audit system design
- Notification architecture
- File storage patterns
- Configuration management
- Scheduler design
- Reporting engine design
- Service versioning strategy
- Service deployment procedures

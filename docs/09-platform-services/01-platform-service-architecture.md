# Platform Service Architecture

## 1. Purpose

Platform services provide reusable cross-cutting capabilities used by multiple ERP business modules. They are shared platform capabilities, not business-domain ownership substitutes.

The current platform-service scope includes:

- Notification and communication services
- Document management and document lifecycle services
- Workflow engine services
- Shared integration points for platform capabilities

Other platform concerns have their own canonical documents and are referenced rather than duplicated here:

- AI platform architecture — `docs/09-platform-services/03-ai-platform-architecture.md`
- Enterprise configuration — `docs/09-platform-services/04-enterprise-configuration-framework.md`
- Localization and internationalization — `docs/09-platform-services/05-localization-internationalization.md`
- File-storage implementation guidance — `docs/04-backend/14-file-storage-architecture.md`
- Security architecture — `docs/06-security/04-enterprise-security-architecture.md`
- Master-data governance — `docs/03-database/20-master-data-management.md`

## 2. Architectural Position

Platform services are logical capabilities within the ERP modular-monolith architecture. They are not required to be independently deployed microservices.

Business modules consume platform capabilities through defined contracts. A business module must not create a competing implementation of a shared platform capability when the corresponding platform service already exists.

Platform services must not take ownership of business-domain records merely because they provide a shared technical capability.

Examples:

- Finance owns accounting records; notification services may notify users about finance events.
- Sales owns sales transactions; document services may store related documents.
- Workflow owns workflow execution state; the business module owns the business transaction being approved.
- Quality owns quality records; document services may store supporting evidence.

## 3. Notification & Communication Framework

The notification framework provides centralized delivery of system-generated communications to users, customers, suppliers, partners, and integrated systems.

### 3.1 Objectives

- Centralize communications.
- Provide consistent notification behavior.
- Support configurable delivery channels.
- Maintain delivery and notification history.
- Reduce duplicate notification implementations.

### 3.2 Sources

Notifications may originate from any authorized ERP module or platform service. The source must remain identifiable.

Examples include Sales, Procurement, Inventory, Finance, HR, Manufacturing, CRM, Asset Maintenance, Quality, Workflow, and system administration.

Project Management is not an active module and must not be treated as a notification source.

### 3.3 Notification Types

The framework may support categories such as:

- Information
- Success
- Warning
- Error
- Approval request
- Reminder
- Assignment
- Escalation
- Deadline alert
- System announcement

The exact set and presentation rules are configurable rather than hard-coded by this architecture document.

### 3.4 Delivery Channels

The framework can provide adapters for channels such as:

- In-application notifications
- Email
- SMS
- Push notifications
- Desktop notifications
- Webhooks
- Other external communication providers where explicitly integrated

The architecture does not imply that every channel or provider is implemented in every deployment.

Organizations may enable or disable supported channels according to configuration and available integrations.

### 3.5 Notification Lifecycle

A notification may progress through states such as:

`Created → Queued/Processing → Delivered/Failed → Viewed → Acknowledged`

Not every channel necessarily supports every state. Delivery and processing outcomes must be recorded where the channel supports them so failures and retries can be audited.

### 3.6 User Preferences

The framework may support configurable preferences including:

- Preferred delivery channels
- Notification categories
- Quiet hours
- Immediate alerts
- Digest/daily summary preferences

Organization-level defaults may be provided where appropriate. Security and mandatory operational notifications must not be bypassed merely through user preference settings.

### 3.7 Templates

Communication templates may support:

- Subject and body
- Placeholders
- Localization
- Attachments where the delivery channel supports them
- Branding/configuration
- Versioning

Templates are configuration/data and must not require business-module code changes for ordinary content changes.

### 3.8 Delivery Policies

Supported policies may include:

- Immediate delivery
- Scheduled delivery
- Batch/digest delivery
- Retry policies
- Delivery priority
- Channel fallback where explicitly configured

The architecture does not mandate asynchronous processing for every notification. Synchronous and asynchronous processing may both be used according to the delivery requirement.

### 3.9 Tracking and Reporting

The framework should support appropriate tracking of:

- Delivery status
- Failure reason
- Retry attempts
- View/acknowledgement status where available
- User preferences

Typical reporting includes delivery statistics, failed deliveries, pending notifications, channel performance, and notification history.

## 4. Document Management

Document management provides a shared repository and lifecycle capability for electronic business documents.

### 4.1 Scope

Examples include:

- Sales quotations and invoices
- Purchase orders and receipts
- Payment-related documents
- Employee documents
- Contracts
- Drawings and images
- Compliance certificates
- Other configured business documents

Business modules remain responsible for the business meaning and ownership of the related transaction. The document service manages document storage, metadata, lifecycle, and access according to established contracts.

### 4.2 Metadata

Document metadata may include:

- Document identifier
- Document type
- Organization/tenant
- Branch where applicable
- Related module
- Related transaction/entity
- Uploaded by
- Upload date
- Version
- Status

### 4.3 Versioning

Where versioned documents are supported, the service should maintain revision history and preserve historical versions as immutable records.

Check-in/check-out, comparison, and restoration are capabilities that may be provided where required; this document does not claim that every deployment must implement all of them.

### 4.4 Security

Document access must follow the central authorization and tenant/security architecture. Applicable permissions may include view, download, upload, edit, and delete operations.

Sensitive documents may require additional controls.

Document access and lifecycle operations must be auditable where required by the governing security/audit policy.

### 4.5 Storage

The document service must use the established file-storage abstraction rather than exposing storage-provider details to business modules.

Supported deployment options may include local/network storage or object storage where the implementation supports them. This architecture does not mandate a particular storage vendor or deployment topology.

## 5. Workflow Engine

The Workflow Engine is a shared platform capability. Business modules define their business workflows and invoke the engine through established contracts; they do not create separate workflow engines.

The detailed business-module workflow architecture is documented in `docs/08-business-modules/14-workflow-bpm-module-architecture.md`.

### 5.1 Core Concepts

A workflow can contain:

- Trigger
- Conditions
- Steps
- Participants
- Approvals
- Rejections
- Notifications
- Completion rules
- Escalations

### 5.2 Triggers

Possible triggers include record creation/update, approval requests, business events, scheduled events, and other explicitly supported integration events.

The examples in this document are illustrative, not an exhaustive implementation contract.

### 5.3 Actions

Workflow actions may include:

- Assign task
- Request approval
- Send notification
- Invoke an authorized application/service operation
- Generate a document through the document service
- Escalate
- Complete or terminate a process

A workflow must not bypass another module's domain boundary by directly modifying its private persistence.

### 5.4 Approval and Escalation

Approval paths and escalation rules are configurable according to organizational policy.

The platform must preserve the workflow state and audit information necessary to explain who performed an action, when it occurred, and what outcome resulted, subject to the central audit architecture.

### 5.5 Monitoring

Workflow monitoring may provide:

- Active workflows
- Pending approvals/tasks
- Completion times
- Failed workflows
- Escalated cases

Monitoring is operational visibility; it does not transfer ownership of the underlying business transaction from its business module.

## 6. Integration and Ownership Rules

1. Platform services expose reusable capabilities through defined contracts.
2. Business modules remain authoritative for their own domain data.
3. Platform services must not directly access another module's private persistence to implement business behavior.
4. Cross-module operations use approved application/service contracts or integration events.
5. Events may be used where they provide an appropriate integration boundary; the architecture does not require every operation to be event-driven.
6. External providers are integrations, not implicit product dependencies.
7. Tenant isolation and authorization are mandatory and follow the central security architecture.
8. Configuration that varies by organization should be represented as configuration/data rather than hard-coded assumptions.

## 7. AI and Automation Boundary

AI-assisted document processing, notification optimization, workflow assistance, or other intelligent capabilities may be integrated through the canonical AI platform.

AI capabilities must not silently modify authoritative business records or bypass authorization, approval, audit, or module-ownership rules.

Any proposed AI behavior that could materially affect a business transaction requires an explicitly defined control and approval boundary.

## 8. Implementation Guidance for AI/Copilot

When implementing platform services:

- Read the relevant platform-service contract before changing code.
- Reuse existing platform capabilities rather than creating duplicates.
- Preserve module ownership boundaries.
- Do not invent providers, compliance requirements, deployment models, or supported channels that are not established by the repository.
- Do not assume every optional integration is installed or enabled.
- If requirements conflict or a required architectural decision is unclear: **STOP and ask**.

## 9. Related Canonical Documents

- `docs/04-backend/14-file-storage-architecture.md`
- `docs/06-security/04-enterprise-security-architecture.md`
- `docs/08-business-modules/14-workflow-bpm-module-architecture.md`
- `docs/09-platform-services/03-ai-platform-architecture.md`
- `docs/09-platform-services/04-enterprise-configuration-framework.md`
- `docs/09-platform-services/05-localization-internationalization.md`
- `docs/03-database/20-master-data-management.md`

## 10. Status

This document is the canonical architecture for shared platform-service capabilities described above. Implementation details belong in the appropriate backend, security, database, and platform-service documentation.

# Platform Services Architecture

This directory defines shared platform capabilities used by ERP business modules. These capabilities address cross-cutting concerns and must be consumed through approved contracts rather than reimplemented independently inside business modules.

## Current Architectural Position

The ERP backend is a **modular monolith**. Platform services are therefore logical shared capabilities within the current backend, not independently deployed microservices by default.

A platform capability may be extracted into an independently deployed service later only through an approved architectural decision.

## Platform Capabilities

| Document | Capability | Role |
|---|---|---|
| `01-platform-service-architecture.md` | Core platform services | Notifications, document management, workflow capability and shared platform boundaries |
| `02-enterprise-integration-platform.md` | Enterprise integration | APIs, events, messaging, connectors, synchronization, EDI and managed file transfer |
| `03-ai-platform-architecture.md` | AI platform | AI/ML, document intelligence, MLOps and enterprise assistants |
| `04-enterprise-configuration-framework.md` | Configuration | Governed platform-wide configuration and hierarchy |
| `05-localization-internationalization.md` | Globalization | Languages, locales, currencies, regional configuration and localization |

Other platform capabilities may be defined in their authoritative architecture documents when ownership is established.

## Platform Before Features

Business modules must not independently implement shared infrastructure for:

- Authentication and authorization.
- Audit logging.
- Notification delivery.
- File/document storage.
- Shared configuration management.
- Scheduling/background infrastructure.
- Enterprise integration infrastructure.
- AI infrastructure.

A module may contain domain-specific behavior that uses these capabilities, but the shared platform contract remains authoritative for the cross-cutting concern.

## Ownership and Boundaries

Platform services do not become owners of business-domain records merely because they provide a shared capability.

For example:

- Finance owns financial transactions.
- Inventory owns inventory transactions.
- HR owns HR records.
- Sales owns sales-domain records.
- Quality owns quality records.
- Asset Maintenance owns maintenance records.

Platform capabilities coordinate or provide infrastructure around these records through approved contracts.

## Security

Platform capabilities follow the canonical security architecture in `docs/06-security/04-enterprise-security-architecture.md`.

They must preserve tenant isolation, authorization, auditability, data classification, and other applicable security controls.

## Configuration

Platform-level configuration is governed by `04-enterprise-configuration-framework.md`. Module-specific configuration remains with the owning module. Integration-specific configuration remains with the Enterprise Integration Platform.

## Globalization

Platform-level localization is governed by `05-localization-internationalization.md`. Frontend-specific localization remains governed by `docs/05-frontend/20-localization.md`.

## Integration

The Enterprise Integration Platform is the canonical location for shared external connectivity. Business modules should expose/use published contracts rather than implementing point-to-point infrastructure independently.

## AI

The AI Platform provides optional/approved AI capabilities. AI output is not authoritative business data and must not bypass business-module validation, authorization, or audit requirements.

## Module Usage Pattern

```text
Business Module
      ↓
Published Platform Contract
      ↓
Platform Capability
      ↓
Approved Infrastructure / Integration
```

## AI/Copilot Implementation Rules

AI-assisted development must:

- Check the relevant platform document before creating shared infrastructure.
- Reuse existing platform contracts.
- Avoid duplicate services and duplicate ownership.
- Never invent providers, deployment models, or capabilities that are not established by the repository.
- Keep business-domain ownership with the owning module.
- STOP and ask when platform ownership, contract boundaries, security, or architectural intent is unclear.

## Status

These documents define the current platform-service architecture for the repository. Detailed implementation may proceed only where the corresponding capability and contract are sufficiently defined and approved.
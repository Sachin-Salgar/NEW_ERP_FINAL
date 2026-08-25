# Business Modules Architecture

**Status:** Current business-module architecture
**Scope:** Business-module boundaries, ownership, contracts, and module enablement within the ERP modular monolith.

## Purpose

This directory contains the authoritative business-module architecture and the individual module specifications used when designing and implementing ERP business capabilities.

Business modules are **logical boundaries inside the current modular-monolith backend**. They are not independently deployed services. Each module owns its business rules and private persistence while communicating with other modules through published contracts and approved platform capabilities.

## Current Business Modules

| Document | Module | Purpose |
|---|---|---|
| `02-core-enterprise-modules.md` | Core Enterprise | Organization, branch, identity, roles, permissions, and RBAC capabilities |
| `03-sales-module-architecture.md` | Sales | Sales and order-to-cash business capabilities |
| `04-procurement-module-architecture.md` | Procurement | Procurement and procure-to-pay business capabilities |
| `05-inventory-module-architecture.md` | Inventory | Inventory, warehouse, stock, and related control capabilities |
| `06-manufacturing-module-architecture.md` | Manufacturing | Production planning and manufacturing execution |
| `07-finance-module-architecture.md` | Finance | Financial accounting and finance capabilities |
| `08-hr-module-architecture.md` | Human Resources | Employee and HR business capabilities |
| `09-crm-module-architecture.md` | CRM | Customer relationship and customer-facing sales support capabilities |
| `11-quality-management-module-architecture.md` | Quality Management | Quality planning, inspection, non-conformance, CAPA, audits, supplier/customer quality, and quality analytics |
| `12-asset-maintenance-module-architecture.md` | Asset Maintenance | Asset lifecycle, maintenance, service, condition, and maintenance analytics capabilities |
| `13-bi-analytics-module-architecture.md` | BI & Analytics | Governed analytical, reporting, KPI, and business-intelligence capabilities |
| `14-workflow-bpm-module-architecture.md` | Workflow / BPM | Business workflow and process-automation usage within the platform architecture |

`01-business-modules-architecture.md` defines the overall module architecture and boundary rules. `02-core-enterprise-modules.md` defines the core enterprise capabilities that provide organizational and authorization foundations.

### Deferred / Removed Modules

**Project Management is not currently part of the ERP architecture and its module specification has been deleted.** It must not be treated as an active business module, dependency, licensed capability, or implementation target unless it is explicitly reintroduced through an approved architecture decision.

## Module Boundary Principles

Each business module shall:

- own its business processes and domain rules;
- maintain module-specific configuration where applicable;
- expose explicitly defined application/API contracts;
- consume platform capabilities only when required;
- avoid direct access to another module's private implementation or persistence;
- maintain explicit dependency direction and ownership boundaries;
- remain independently testable within the modular monolith.

**Module independence does not mean independent deployment.** Future extraction into an independently deployed service requires an approved ADR.

## Module Communication

### Within the modular monolith

Modules communicate through published in-process application/service contracts where permitted by the architecture.

```text
Module A
   |
   | published contract
   v
Module B
```

A module must not bypass another module's published contract by directly calling private classes, repositories, or tables.

### External clients and integrations

External clients and integrations use the appropriate REST/API contracts.

### Business events

Business events may be used where required by the implementation and authoritative architecture. A conceptual event does not by itself require Kafka, RabbitMQ, or another distributed message broker.

## Data Ownership

Each module owns its domain data and persistence behavior.

Other modules must not directly query or mutate another module's private tables, repositories, or persistence implementation. Cross-module data access must use the owning module's published contract or an explicitly approved shared/platform mechanism.

Tenant isolation, RLS, audit, soft-delete, transaction scoping, and related database/security controls remain governed by their canonical architecture documents.

## Module Enablement / Licensing

The architecture supports organizations using only the business capabilities/modules they are configured and licensed to use.

There is **no universal list of business modules that every customer must purchase or enable** in this document. Whether one module requires another is determined by the authoritative dependency and implementation rules of the relevant module.

Module enablement may affect:

- frontend module/feature visibility;
- available backend capabilities;
- API authorization;
- organization configuration;
- workflow and integration options.

Frontend visibility is not a security boundary. Backend authorization must enforce access regardless of UI visibility.

A customer-specific module selection must not require unrelated modules to be exposed merely because they exist in the ERP product.

## Module Development Standards

When implementing a business module or feature:

1. Identify the owning business module.
2. Read its authoritative module specification.
3. Identify required platform capabilities and approved module dependencies.
4. Preserve the current modular-monolith architecture.
5. Use published contracts for cross-module interaction.
6. Keep private persistence private to the owning module.
7. Implement authorization at the backend boundary.
8. Add appropriate unit, integration, and end-to-end tests.
9. Document material architectural decisions through ADRs when required.
10. Do not introduce speculative microservices, distributed deployment, or message-broker infrastructure.

If ownership, dependency, contract, data boundary, or required behavior is unclear or conflicting, AI must **STOP and ask** rather than inventing an architectural decision.

## Related Documentation

- [Business Modules Architecture](./01-business-modules-architecture.md) — authoritative module boundaries and communication rules
- [Core Enterprise Modules](./02-core-enterprise-modules.md) — organization, branch, identity, role, permission, and RBAC capabilities
- [Backend Module Development Guidelines](../04-backend/21-module-development-guidelines.md) — implementation rules
- [Enterprise Security Architecture](../06-security/04-enterprise-security-architecture.md) — security boundaries and authorization
- [Platform Service Architecture](../09-platform-services/01-platform-service-architecture.md) — shared platform capabilities

## Status

This README is the index and orientation document for the current business-module architecture. Individual module specifications are the authoritative source for their respective business domains.

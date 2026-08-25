# DevOps, Infrastructure & Deployment

## Purpose

This directory is the active DevOps architecture portal for the Enterprise ERP Platform. It defines deployment, infrastructure, environments, containers, CI/CD, reliability, scalability, observability, backup/recovery, and production operations.

## Active Documents

### Architecture and Deployment

- [01-devops-architecture.md](01-devops-architecture.md) — DevOps principles and operational framework
- [01-deployment-architecture.md](01-deployment-architecture.md) — Deployment architecture and release principles
- [02-infrastructure-architecture.md](02-infrastructure-architecture.md) — Infrastructure and network/storage principles
- [03-environment-management.md](03-environment-management.md) — Environment isolation and promotion
- [04-containerization.md](04-containerization.md) — Containerization and image lifecycle

### Delivery and Reliability

- [05-ci-cd-pipeline.md](05-ci-cd-pipeline.md) — CI/CD validation and delivery
- [06-reliability-fault-tolerance.md](06-reliability-fault-tolerance.md) — Reliability and failure recovery
- [07-scalability.md](07-scalability.md) — Workload and infrastructure scaling

### Operations

- [08-observability.md](08-observability.md) — Metrics, logs, traces, health, and alerting
- [09-backup-disaster-recovery.md](09-backup-disaster-recovery.md) — Backup and disaster recovery
- [11-operations-management.md](11-operations-management.md) — Maintenance and production operations

There is no `10` document in the current repository and it has not been invented or renumbered.

## Architectural Principles

- Automate repeatable operational work where appropriate.
- Keep environments isolated.
- Treat deployment configuration and secrets as environment-specific.
- Prefer immutable, versioned release artifacts.
- Make production changes controlled and recoverable.
- Monitor systems according to operational requirements.
- Test recovery rather than assuming backups are recoverable.
- Scale according to measured workload.
- Keep vendor/tool choices separate from architectural principles unless explicitly established.

## Boundaries

- Application business logic belongs to backend/frontend architecture documentation.
- Security controls are governed jointly with [Security Architecture](../06-security/README.md).
- Database-specific backup/recovery details belong to [Database Documentation](../03-database/README.md) where applicable.
- CI/CD implementation details are determined by the actual repository workflows and deployment configuration.
- This documentation must not invent a CI provider, cloud provider, orchestrator, artifact registry, monitoring product, RTO/RPO value, retention period, or operational SLA unless explicitly established elsewhere.

## Related Documentation

- [Backend Architecture](../04-backend/README.md)
- [Frontend Architecture](../05-frontend/README.md)
- [Security Architecture](../06-security/README.md)
- [Database Architecture](../03-database/README.md)
- [Documentation Management](../00-overview/documentation-management.md)
- [Governance](../00-overview/02-governance.md)

## Maintenance Rules

- Keep this README synchronized with the actual files in this directory.
- Remove obsolete migration/volume metadata from active documents.
- Do not create duplicate documents for the same operational concern without resolving ownership.
- Do not convert illustrative deployment patterns into mandatory implementation requirements without an explicit architecture decision.
- When an operational requirement is unclear, stop and resolve the ambiguity before encoding it as architecture.

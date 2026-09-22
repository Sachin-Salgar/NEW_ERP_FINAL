# Deployment Architecture

**Document Purpose:** Define the deployment architecture and release principles for the Enterprise ERP Platform.

## 1. Introduction

Deployment architecture defines how application components are packaged, released, operated, and recovered across supported environments.

The platform supports containerized deployment and may operate on on-premises or cloud infrastructure according to deployment requirements.

## 2. Objectives

- Repeatable deployments.
- Reliable releases.
- Controlled operational risk.
- Appropriate scalability.
- Recovery and rollback capability.
- Post-deployment validation.

## 3. Environment Progression

The deployment lifecycle may progress through isolated environments such as:

```text
Development → Testing → Staging → Production
```

The exact environment topology is defined by environment-management requirements. Production data and secrets shall not be shared casually across environments.

## 4. Deployment Components

A deployment may contain:

```text
Load Balancer / Reverse Proxy
          ↓
Application Services
          ↓
PostgreSQL
          ↓
Cache / Queue Workers / Object Storage
          ↓
Monitoring and Logging
```

The actual topology depends on deployment size and infrastructure choices.

## 5. Containerization

Application services should use the repository's containerization standards where containers are selected as the deployment mechanism. Application containers should remain stateless where practical; persistent business data belongs in persistent infrastructure.

## 6. CI/CD Integration

Deployments should be driven by the established CI/CD process:

```text
Source Change
    ↓
Validation / Tests
    ↓
Build Artifact
    ↓
Deployment
    ↓
Health Validation
    ↓
Monitoring
```

Production release gates and approvals are governed by the repository's actual CI/CD and operational policy.

## 7. Deployment Strategies

Rolling, blue-green, canary, or maintenance-window deployment may be used where the infrastructure and operational requirements justify them. No single strategy is mandatory for every deployment.

## 8. Database Changes

Deployments involving schema changes shall follow the database migration process, including validation and recovery planning. Backup and recovery requirements are defined by the backup/disaster-recovery architecture.

## 9. Post-Deployment Validation

Validation should include, as applicable:
- Application/API health.
- Database connectivity.
- Background processing.
- Authentication.
- Error and performance indicators.

## 10. Summary

Deployment architecture provides a controlled path from validated software changes to reliable operation while preserving environment isolation, recovery capability, and operational observability.

## 11. Current Deployment Boundaries

The current development topology is a Windows developer machine running the
Flutter frontend, backend service, and PostgreSQL 17. The Vercel configuration
builds the Flutter web output and rewrites browser routes to the frontend entry
point; it does not establish tenant identity or connect directly to PostgreSQL.
The backend endpoint and CORS allowlist remain deployment configuration concerns.

Production is currently deployed using Vercel for Flutter Web, Render for the Fastify backend, and Render PostgreSQL. The architecture remains provider-portable; provider-specific operational facts are recorded in `docs/07-devops/12-current-deployment-topology.md`.

## 11. Canonical Database Provisioning

All supported PostgreSQL environments use one repository-controlled provisioning
pipeline. There is no provider-specific manual migration/seed sequence.

```text
npm run db:provision
```

Compiled deployment images use:

```text
npm run db:provision:compiled
```

The pipeline performs, in order:

```text
preflight
  → all journaled migrations
  → platform security/RLS bootstrap
  → platform administrator bootstrap
  → final verification
  → database ready
```

The pipeline requires three separate connections:
- `DB_PROVISIONING_DATABASE_URL`: privileged security/provisioning operator.
- `DB_MIGRATION_DATABASE_URL`: object-creating migration role, normally `erp`.
- `DATABASE_URL`: runtime application connection, normally `erp_app`.

The three connections must point to the same target database. The privileged
provisioning credential must never be exposed to the running application.

A clean database and an existing database use the same pipeline. Migrations are
journal-driven and idempotent; security/bootstrap converges on the declared
contract; the platform administrator seed is idempotent and does not overwrite
an existing administrator password; final verification must pass before the
database is declared ready.

The backend start command remains runtime-only:

```text
node dist/main.js
```

It does not run migrations, create roles, alter grants, or perform privileged
security bootstrap.

For Render paid services, `npm run db:provision:compiled` is the intended
pre-deploy command. Render documents pre-deploy as the deployment stage for
database migrations and other release prerequisites and runs it separately from
the running web service. The current Free Render service cannot use native
pre-deploy; this is a provider-plan limitation. The canonical architecture
must not be weakened by moving privileged provisioning into web startup.

The same repository pipeline is used for local PostgreSQL, CI PostgreSQL,
Render PostgreSQL, and other supported PostgreSQL providers. Provider-specific
credential acquisition is configuration; the provisioning sequence and
verification contract are not provider-specific.


## Cross References

- [DevOps Architecture](./01-devops-architecture.md)
- [Environment Management](./03-environment-management.md)
- [Containerization](./04-containerization.md)
- [CI/CD Pipeline](./05-ci-cd-pipeline.md)
- [Backup & Disaster Recovery](./09-backup-disaster-recovery.md)
- [Observability](./08-observability.md)
- [Current Deployment Topology](./12-current-deployment-topology.md)
- [Deployment Audit 2026-09-21](./13-deployment-audit-2026-09-21.md)

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

Future managed deployments select their PostgreSQL endpoint and TLS behavior
through environment configuration. No final production provider is selected by
this repository.

For migration `0009` and later, the local and future release order is:

```text
PostgreSQL 17 available
  → run npm run db:migrate as erp
  → run PLATFORM_SECURITY_DATABASE_URL=<privileged operator URL> npm run db:security-bootstrap
  → start the application with DATABASE_URL using erp_app
```

`PLATFORM_SECURITY_DATABASE_URL` must be supplied only to the explicit security
bootstrap command as a separate privileged operator credential. It must not be
supplied to the normal application process or used as `DATABASE_URL`. The
bootstrap transaction normalizes dedicated roles, transfers lifecycle-function
ownership, applies the minimal grants, and verifies the security matrix. A
failure rolls back the bootstrap and the application startup verification
refuses to serve traffic.

Dependency installation in deployment must use the repository lockfile consistently with its manifest and must preserve frozen/reproducible lockfile validation. A stale lockfile is a release defect; disabling frozen-lockfile validation is not an acceptable workaround.

The repository does not claim production evidence for worker supervision, external providers, key rotation, backup restoration, database-role separation for pre-authentication lookup, registry attestations, or graceful shutdown until those checks are executed in the target environment.

## Cross References

- [DevOps Architecture](./01-devops-architecture.md)
- [Environment Management](./03-environment-management.md)
- [Containerization](./04-containerization.md)
- [CI/CD Pipeline](./05-ci-cd-pipeline.md)
- [Backup & Disaster Recovery](./09-backup-disaster-recovery.md)
- [Observability](./08-observability.md)

# Containerization

**Document Purpose:** Define containerization principles for repeatable ERP deployment.

## 1. Introduction

Containerization packages an application and its runtime dependencies into a reproducible deployment unit.

Docker is the current documented containerization technology. The architecture should nevertheless keep application design independent of a specific orchestration platform.

## 2. Objectives

- Consistent runtime environments.
- Repeatable deployment.
- Portability.
- Appropriate scalability.
- Controlled image lifecycle.

## 3. Containerized Components

Components may include:
- Backend API.
- Background workers.
- Scheduled jobs.
- Flutter Web application where web deployment is used.
- Reverse proxy.
- Supporting operational components where appropriate.

The database may be containerized for development/testing. Production database hosting is deployment-specific.

## 4. Container Principles

Containers should be:
- Stateless where practical.
- Immutable after build.
- Versioned.
- Health monitored.
- Independently deployable where service boundaries justify it.

Persistent business data shall not depend on the writable lifecycle of an application container.

## 5. Image Security

Images should:
- Be reproducible.
- Use controlled versions.
- Be vulnerability-scanned through the operational security process.
- Avoid embedded credentials or secrets.
- Be stored in an appropriately trusted registry.

Image signing may be used where the deployment platform supports and requires it.

## 6. Resource and Health Controls

Deployment definitions should provide appropriate:
- CPU/memory controls.
- Restart behavior.
- Health checks.
- Logging configuration.

Actual limits are workload/deployment decisions and shall not be invented in feature code.

## 7. Versioning

Production deployments should reference immutable image versions or digests. Floating tags such as `latest` should not be used as production release identifiers.

## 8. Summary

Containerization provides a repeatable packaging and deployment model while keeping persistent state, secrets, and deployment-specific infrastructure outside application image contents.

## Cross References

- [Infrastructure Architecture](./02-infrastructure-architecture.md)
- [CI/CD Pipeline](./05-ci-cd-pipeline.md)
- [Security Operations](../06-security/03-security-operations.md)

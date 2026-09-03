# ADR-0013: Centralized TLS for Managed PostgreSQL Connections

**Date**: 2026-09-03  
**Status**: Approved  
**Approval Date**: 2026-09-03  
**Approved By**: Project Owner  
**Scope**: PostgreSQL connection configuration for application runtime and operational tooling

## Context

The ERP connects to PostgreSQL in local development, automated test environments, and managed or otherwise non-local deployments. These environments require consistent connection behavior without embedding deployment-specific credentials or provider assumptions in application code.

The application runtime and the controlled operational seed tooling must use one connection-configuration policy so that managed PostgreSQL requirements are not implemented independently in each consumer.

## Decision

PostgreSQL connections to managed or non-local databases use TLS through the centralized database connection factory. Certificate validation remains enabled with `rejectUnauthorized: true`.

Local development behavior is preserved according to the existing connection conventions: local loopback PostgreSQL connections may continue to use the local configuration without the managed-database TLS requirement.

The application runtime and operational seed tooling use the same centralized connection configuration. Database credentials, URLs, certificates, and other secrets remain environment-provided and must never be hard-coded or emitted to logs.

This decision changes connection configuration only. It does not alter database schemas, migrations, RLS policies, or migration execution.

## Rationale

- Centralization prevents application and operational tooling from drifting into incompatible connection behavior.
- TLS protects managed PostgreSQL traffic in transit.
- Certificate validation prevents silently accepting an untrusted database endpoint.
- Environment-provided configuration preserves deployment portability and secret-management boundaries.
- Local development remains compatible with the repository's existing loopback workflow.

## Alternatives Considered

1. **Configure TLS independently in each consumer** — rejected because duplicated connection policy can diverge.
2. **Disable certificate validation for managed databases** — rejected because it weakens endpoint authentication.
3. **Force TLS behavior on local development without regard to existing conventions** — rejected because it would unnecessarily change the local workflow.
4. **Hard-code provider-specific connection details** — rejected because deployment providers and credentials are configuration concerns, not source-code architecture.

## Consequences

### Positive

- Managed PostgreSQL connections consistently use encrypted, certificate-validated transport.
- Runtime and seed tooling share one connection policy.
- Provider changes do not require source-code credential changes.

### Negative

- Managed environments must provide a certificate chain trusted by the runtime.
- A misconfigured managed database endpoint fails connection validation rather than silently downgrading transport.
- Local and managed connection behavior remains intentionally different.

## Implementation Notes

- Keep PostgreSQL pool construction in the centralized database connection module.
- Operational scripts that connect to PostgreSQL must use that centralized factory rather than constructing an independent pool.
- Commit `1a62d12` is implementation evidence for this decision, not part of the architectural rule.

## Validation Evidence

- TLS certificate validation succeeded against the controlled Render PostgreSQL deployment.
- The application runtime and `scripts/seed-custom-tenant.ts` use the centralized connection factory.
- No migration or schema change is required by this decision.

## Related Documents

- [Database Security Architecture](../03-database/16-security-architecture.md)
- [Configuration Management](../04-backend/18-configuration-management.md)
- [Environment Management](../07-devops/03-environment-management.md)


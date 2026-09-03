# ADR-0013: Centralized PostgreSQL Connection Policy for Managed Endpoints

**Date**: 2026-09-03  
**Status**: Approved  
**Approval Date**: 2026-09-03  
**Approved By**: Project Owner  
**Scope**: Centralized PostgreSQL connection configuration, endpoint selection, and transport security for application runtime and operational tooling

## Context

The ERP connects to PostgreSQL in local development, automated test environments, and managed or otherwise non-local deployments. These environments require consistent connection behavior without embedding deployment-specific credentials or provider assumptions in application code.

The application runtime and the controlled operational seed tooling must use one connection-configuration policy so that managed PostgreSQL requirements are not implemented independently in each consumer.

Render provides an External Database URL for connections from outside Render and an Internal Database URL for Render services in the same region. Render recommends the Internal URL for same-region services because it uses Render's private network, while External connections use Render-managed TLS certificates. Endpoint selection is therefore an environment and deployment concern, not an application-code concern.

## Decision

PostgreSQL connection creation remains centralized in `src/infrastructure/database/connection.ts`. Application code must not create ad-hoc connection policies or detect provider hostnames.

The configured `DATABASE_URL` determines the endpoint consumed by the application without requiring the application to distinguish Internal from External URLs:

* Local development uses the Render External Database URL because the developer machine is outside Render's private network. TLS is enabled and certificate validation is required.
* The Render production service uses the Render Internal Database URL for same-region private-network connectivity. The application must not require external PostgreSQL connectivity when running inside Render.
* The configured environment selects the connection behavior; the application does not infer it from a hostname or provider.

For any connection where TLS is configured, certificate validation remains mandatory with `rejectUnauthorized: true`. Certificate verification must never be disabled for a TLS connection. The centralized factory applies the configured transport policy without inferring policy from a hostname.

The current repository security requirement for TLS on all database connections is refined by this decision to distinguish the connection/security boundary and the provider-documented endpoint model rather than treating every non-loopback hostname identically. This refinement does not authorize disabling certificate validation where TLS is used.

The application runtime and operational seed tooling use the same centralized connection configuration. Database credentials, URLs, certificates, and other secrets remain environment-provided and must never be hard-coded or emitted to logs.

This decision changes connection configuration only. It does not alter database schemas, migrations, or RLS policies.

## Rationale

- Centralization prevents application and operational tooling from drifting into incompatible connection behavior.
- Environment-specific endpoint selection keeps provider and network-boundary knowledge out of application code.
- TLS and certificate validation protect connections where TLS is used and prevent silently accepting an untrusted database endpoint.
- Environment-provided configuration preserves deployment portability and secret-management boundaries.
- The Render service can use the provider-recommended private-network endpoint without requiring a provider-specific hostname branch in application code.

## Alternatives Considered

1. **Configure TLS independently in each consumer** — rejected because duplicated connection policy can diverge.
2. **Disable certificate validation for TLS connections** — rejected because it weakens endpoint authentication.
3. **Treat every non-loopback hostname as requiring identical transport settings** — rejected because endpoint security characteristics depend on the deployment and network boundary.
4. **Detect provider hostnames in application code** — rejected because endpoint selection and provider configuration belong in deployment configuration.
5. **Use the External URL for the Render service** — not selected as the standard same-region deployment path because Render recommends the Internal URL for private-network connectivity; it remains the external path for local development outside Render.

## Consequences

### Positive

- Connections that use TLS consistently use certificate validation.
- Runtime and seed tooling share one connection policy.
- Endpoint selection and provider changes do not require source-code credential changes.

### Negative

- A TLS-enabled endpoint must provide a certificate chain trusted by the runtime or an approved environment-provided CA configuration.
- A misconfigured TLS-enabled endpoint fails connection validation rather than silently downgrading transport.
- Local development and Render production intentionally use different Render endpoint classes.

## Implementation Notes

- Keep PostgreSQL pool construction in the centralized database connection module.
- Operational scripts that connect to PostgreSQL must use that centralized factory rather than constructing an independent pool.
- Application code must not detect Render hostnames or branch between Internal and External URLs based on hostname.
- Commit `1a62d12` is implementation evidence for the overly broad `non-localhost hostname -> force validated TLS` behavior, not part of the architectural rule.
- `src/infrastructure/database/migrate.ts` uses the shared connection-policy helper for its `pg.Client` options. The migration path remains a separate client lifecycle, but it no longer defines an independent TLS policy.

## Validation Evidence

- TLS certificate validation succeeded against the controlled Render External PostgreSQL endpoint.
- The application runtime and `scripts/seed-custom-tenant.ts` use the centralized connection factory.
- The application runtime, migrations, and operational seed tooling use the shared database transport policy.
- Render documentation confirms separate Internal and External URLs, recommends Internal URLs for same-region Render services, and documents Render-managed TLS for External connections.
- No migration or schema change is required by this decision.

## Related Documents

- [Database Security Architecture](../03-database/16-security-architecture.md)
- [Configuration Management](../04-backend/18-configuration-management.md)
- [Environment Management](../07-devops/03-environment-management.md)

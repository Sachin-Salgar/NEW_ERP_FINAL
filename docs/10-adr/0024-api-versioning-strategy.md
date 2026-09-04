# ADR-0024: API Versioning Strategy

**Date**: 2026-09-04  
**Status**: Proposed  
**Scope**: Public HTTP API compatibility and version lifecycle

## Context

ERP clients may include web, mobile, integrations, and customer-specific deployments. API contracts must evolve without silently breaking existing consumers, while avoiding unnecessary version proliferation.

## Decision

Adopt explicit major-version URL namespaces for externally consumed HTTP APIs, beginning with `/api/v1`.

1. Major API versions are represented in the URL path, for example `/api/v1/...`.
2. Backward-compatible additions within a major version are permitted without creating a new version.
3. Breaking changes require a new major version.
4. Each major version has an explicit lifecycle and deprecation policy before removal.
5. Error, pagination, authentication, and content-type contracts are versioned as part of the API surface and must remain internally consistent within a major version.
6. Version negotiation through arbitrary headers is not required for the primary public contract.
7. Internal module/application contracts are not independently versioned as HTTP APIs; they follow the modular-monolith architecture and normal code compatibility practices.
8. OpenAPI documentation is published per supported API major version.
9. New endpoints should be introduced in the current supported version unless there is a deliberate compatibility reason to introduce a newer major version.

## Rationale

URL-based major versions are explicit, easy for clients and operators to understand, and work across browsers, mobile clients, proxies, and integrations. Separating major breaking changes from additive evolution avoids excessive versioning overhead.

## Alternatives Considered

- **Header-only versioning** — rejected as the primary strategy because version selection is less visible and less convenient for many integrations.
- **Query-parameter versioning** — rejected because it is easier to omit accidentally and complicates caching/observability semantics.
- **Version every endpoint for every change** — rejected because additive backward-compatible changes do not require a new contract.

## Consequences

- Requires an explicit current-version/deprecation policy and OpenAPI organization.
- Existing routes need a migration plan before the versioned API becomes the external compatibility boundary.
- Prevents uncontrolled breaking changes to integrations.

## Implementation Notes

Do not mechanically prefix every current internal route until the API boundary migration is planned. Define the supported-version matrix, deprecation notice period, and compatibility test suite before declaring v1 production-stable.

## Related Documents

- `docs/04-backend/20-openapi-swagger.md`
- `docs/04-backend/21-pagination-implementation.md`

# ADR-0014: Audit Logging Foundation

**Date**: 2026-09-04  
**Status**: Proposed  
**Scope**: Security, authorization, identity, and business audit records across the ERP

## Context

The ERP needs trustworthy auditability for security-sensitive and materially important business actions. Audit records must remain tenant-scoped, attributable to an authenticated actor where applicable, resistant to ordinary application mutation, and useful for investigation without becoming a secondary store for secrets or arbitrary request payloads.

## Decision

Establish a centralized audit logging foundation backed by PostgreSQL.

1. Store audit records in an append-oriented `audit_events` model with tenant context, actor identity, action, resource type, resource identifier, timestamp, outcome, correlation/request identifier, and structured metadata.
2. Audit records are created through an application-level `AuditLogger` contract rather than direct writes scattered through controllers.
3. Security-critical mutations must write their audit event in the same database transaction as the protected mutation when both are database operations.
4. Audit records are immutable through the normal application API. Administrative retention/deletion, if ever required, must be governed separately and must not permit ordinary users to alter history.
5. Secrets, passwords, tokens, MFA secrets, and complete sensitive request/response bodies must never be recorded. Metadata is allowlisted by event type.
6. Tenant isolation and PostgreSQL RLS apply to tenant-owned audit records. Authorized global/security administrators may have explicitly governed cross-tenant audit access.
7. Correlation IDs from the HTTP layer are recorded when available to connect audit events with request traces.

## Rationale

A database-backed foundation provides durable, queryable audit history without introducing a second infrastructure dependency. Transactional recording prevents a successful sensitive mutation from becoming unaudited because a separate logging path failed.

## Alternatives Considered

- **Application log files only** — rejected because logs are not a durable tenant-scoped audit authority.
- **External SIEM as the primary store** — deferred; useful as a downstream sink but adds deployment and availability dependencies.
- **Generic database triggers for every table** — rejected as the primary mechanism because business meaning and actor attribution are not reliably available at trigger level.

## Consequences

### Positive

- Consistent audit semantics across modules.
- Stronger forensic traceability.
- Reuses existing tenant and correlation-ID architecture.

### Negative

- Adds write and storage overhead to audited mutations.
- Event schemas and retention require governance.

## Implementation Notes

Define event types and metadata allowlists before broad adoption. Add indexes for tenant/time, actor/time, and resource lookup according to measured usage. Retention and archival policy should be defined before production rollout.

## Related Documents

- `docs/04-backend/07-authentication-and-authorization.md`
- `docs/03-database/11-multi-tenancy.md`
- `docs/04-backend/20-correlation-id.md`

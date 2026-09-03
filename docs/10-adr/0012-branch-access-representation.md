# ADR-0012: Branch Access Representation

**Date**: 2026-09-03  
**Status**: Approved  
**Approval Date**: 2026-09-03  
**Approved By**: Project Owner  
**Scope**: Tenant-scoped user authorization for Branch records

## Context

The ERP must represent Branch authorization consistently with the current database model and PostgreSQL tenant-isolation boundary. The `user_branch_access` table is an access-assignment relation, while activation state is not part of that relation's schema.

The current schema and migrations define `user_branch_access` with only `tenant_id`, `user_id`, and `branch_id`. This differs intentionally from `user_location_access`, which has its own schema and includes `is_active`.

## Decision

Branch authorization is represented by the existence of a tenant-scoped access row in `user_branch_access` for the `(user_id, branch_id)` pair.

The following constraints remain mandatory for every branch-access operation:

- the access row and Branch belong to the same tenant;
- the access row identifies the authenticated user;
- the access row identifies the requested Branch; and
- the Branch is valid for any requested Organization context and active-record checks required by the repository.

`user_branch_access` has no `is_active` field. Repository queries must not filter Branch access using `user_branch_access.is_active`.

This decision is specific to `user_branch_access`. The schema and authorization behavior of `user_location_access` must not be generalized from or substituted for the Branch access model.

## Rationale

- It matches the actual current schema and migration history.
- Access-row existence provides an unambiguous tenant/user/Branch authorization check.
- Tenant and relationship constraints preserve the PostgreSQL RLS and application authorization boundaries.
- Keeping Branch and Location access decisions separate avoids imposing a field or lifecycle that the corresponding table does not define.

## Alternatives Considered

1. **Add or assume `is_active` on Branch access rows** — rejected because the current schema and migrations do not define that field.
2. **Treat Branch access as Organization access** — rejected because Branch authorization is a distinct operational authorization boundary.
3. **Generalize Location access columns and behavior to Branch access** — rejected because the two access tables intentionally have different schemas.

## Consequences

### Positive

- Repository queries remain aligned with the database contract.
- Branch authorization remains tenant-safe and explicitly user- and Branch-scoped.
- Schema differences between Branch and Location access remain visible and intentional.

### Negative

- Revoking Branch access requires removing the access row or using an authorization mechanism defined by a future approved decision; this ADR does not introduce an activation lifecycle.
- Callers must validate Organization/Branch relationships separately when an Organization context is supplied.

## Implementation Notes

- Use the composite tenant/user/Branch relationship defined by the schema and migrations.
- Do not add `is_active` predicates to `user_branch_access` queries.
- Commit `ab542df` is implementation evidence for this decision, not part of the architectural rule.

## Related Documents

- [Organization, Branch, and Location Context Model](./0011-organization-branch-location-context.md)
- [Organizational Isolation](../03-database/12-organizational-isolation.md)
- [Backend Authentication and Authorization](../04-backend/07-authentication-and-authorization.md)


# ADR-0041: Branch Working Context and Authorization

**Date**: 2026-09-09  
**Status**: Approved  
**Approval Date**: 2026-09-09  
**Approved By**: Project Owner  
**Scope**: Tenant branch access, authenticated branch working context, Financial Year compatibility, and branch-scoped business operations

## Context

The ERP correctly establishes tenant context from authenticated identity and
uses tenant-only PostgreSQL RLS. Branches are business subdivisions inside a
tenant, but branch-scoped transaction services previously relied on a session
branch UUID without consistently proving that the user could use that branch.
The user's `default_branch_id` could also be populated without an explicit
`user_branch_access` grant.

## Decision

The security chain is:

```text
Identity
  ↓
Tenant membership and automatic tenant context
  ↓
Tenant-scoped user_branch_access
  ↓
Server-authoritative current branch context
  ↓
Financial Year context
  ↓
Branch-scoped business transaction
  ↓
Tenant + branch + Financial Year repository scope
  ↓
Tenant-only PostgreSQL RLS
```

### Branch authorization

A branch is eligible for a user only when:

1. the branch belongs to the authenticated tenant;
2. the user has a tenant-scoped `user_branch_access` row for the branch;
3. the branch is active; and
4. the branch is not soft-deleted.

`default_branch_id` is a preference/default pointer. It is never an
authorization grant. Assigning or using a default branch requires the same
branch-access proof.

Users may have multiple active branch grants. Tenant administrator permission
does not implicitly grant every branch; explicit branch access remains the
authorization source.

### Current branch context

The current branch is server-authoritative and is stored in the authenticated
tenant session. Login uses the user's default branch only when that branch is
eligible. If no eligible default exists, the session has no branch context and
branch-scoped operations fail closed.

An authenticated tenant user may change the current branch through the
server-authoritative branch-context operation. The operation accepts a requested
branch identifier, validates tenant membership, explicit branch access, active
status, and non-deleted status, validates the selected Financial Year, and
updates the existing tenant session. It cannot change tenant context and does
not create tenant selection or tenant switching.

Requests never use frontend storage, request headers, or an arbitrary body
identifier as branch authority. The validated database session is authoritative.
Client-supplied branch identifiers are inputs to the context-change operation
only and are never trusted without server validation.

### Revocation and branch lifecycle

Every branch-scoped service operation revalidates the current session branch
against tenant, user, branch status, deletion state, and
`user_branch_access` before module/permission-protected work reaches a
repository. Consequently, revoking access or making a branch inactive/deleted
denies subsequent branch-scoped operations without relying on session expiry.
Existing sessions are not required to be destroyed when access changes.

### Financial Year relationship

Financial Year remains tenant-owned and may optionally carry a branch
association. A branch-scoped operation requires an active, open, unlocked,
non-deleted Financial Year belonging to the tenant. If the Financial Year has a
non-null `branch_id`, it must equal the current branch. A tenant-wide Financial
Year (`branch_id IS NULL`) is valid for any otherwise-authorized branch.

The Financial Year in the server session is authoritative. Client-supplied
Financial Year identifiers cannot bypass validation.

### Layer responsibilities

- **Authentication/session** establishes and persists tenant, branch, and
  Financial Year context from trusted server state.
- **Branch service** owns branch-access and Financial Year compatibility
  validation.
- **Business services** enforce authentication, module entitlement, RBAC,
  current-branch authorization, and Financial Year validity before repository
  calls.
- **Repositories** retain tenant, branch, and Financial Year predicates and
  composite same-tenant foreign keys. They do not replace user authorization.
- **Frontend** treats server context as authoritative. Local branch state is a
  cache only and is refreshed from successful server responses.
- **PostgreSQL** retains tenant-only RLS through `app.current_tenant_id`.
  Branch is not an RLS boundary.

## Security invariants

- `default_branch_id` never grants access.
- A user cannot transact in a branch without explicit tenant-scoped branch
  access.
- Cross-tenant branch references fail through tenant context and composite
  constraints.
- Inactive and deleted branches are unusable.
- Revoked access is effective on the next branch-scoped operation.
- Tenant and branch identifiers supplied by clients cannot override server
  context.
- Tenant-only domains remain tenant-scoped.
- Platform sessions cannot access tenant business APIs.
- No tenant selector or tenant switching is introduced.

## Testing requirements

Each applicable vertical keeps a dedicated authorization-proof file. Proofs
must cover authorized access, same-tenant unauthorized branch, cross-tenant
isolation, inactive/deleted branch, revoked access, default-branch integrity,
client branch/tenant spoof resistance, Financial Year mismatch, module/RBAC
controls, and tenant-only RLS. Tests must use the real authenticated
application path wherever practical.

## Consequences

Branch authorization becomes explicit and consistent across all branch-scoped
verticals. Session context remains convenient and stable, while revocation and
branch lifecycle changes take effect without waiting for token/session expiry.
Clients must refresh context from the server after login, restoration, or a
branch-context change. Additional service checks add small per-operation
authorization queries but preserve the existing tenant-only RLS architecture.

## Rejected alternatives

1. Treating `default_branch_id` as an access grant.
2. Trusting branch headers or request-body identifiers for transaction
   authorization.
3. Making Branch a PostgreSQL RLS boundary.
4. Granting all branches implicitly to tenant administrators.
5. Introducing tenant selection or tenant switching to solve branch context.

## Related Documents

- [ADR-0040](./0040-platform-identity-membership-and-context.md)
- [ADR-0025](./0025-sales-transaction-context.md)
- [ADR-0012](./0012-branch-access-representation.md)
- [Document Control and Governance](../00-overview/02-governance.md)

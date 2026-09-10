# ADR-0042: Unified Login and Membership-Based Context Selection

**Date**: 2026-09-10
**Status**: Accepted
**Approval**: Accepted by the Architecture Review Board

## 1. Decision

The ERP should provide one login UI. After credential authentication, the
server should resolve all currently usable application contexts for the
authenticated identity.

The resolution rule is:

```text
0 usable contexts  -> safe authentication/context failure
                    -> no tenant or platform session
                    -> no usable application JWT

1 usable context   -> create that context's session
                    -> navigate directly to its destination
                    -> no selector

2+ usable contexts  -> create no application session
                    -> issue only short-lived pending selection state
                    -> show server-provided context choices
                    -> revalidate the selected context
                    -> create the selected context's session
```

The governing rule is: **direct if exactly one usable context; select only
when multiple usable contexts exist.**

This ADR is accepted architecture and authorizes implementation planning. It
does not claim that the capability has been implemented.

## 2. Context / Problem

The current implementation has separate authentication paths:

- `POST /api/v1/auth/login` creates tenant sessions.
- `POST /api/v1/auth/platform-login` creates platform sessions.
- The current Flutter login screen calls only the tenant login endpoint.

Consequently, one identity cannot currently use one login experience to enter
either a tenant or platform context, and the server does not yet resolve all
identity-wide contexts before session creation.

The existing architecture already has separate identities, memberships,
tenant/platform sessions, JWT context claims, and authorization boundaries.
This decision evolves login-time context resolution without redesigning that
identity model.

## 3. Current State

The current implementation is not this decision:

- Tenant login resolves active login candidates and active tenant users,
  rejects ambiguous valid tenant candidates, and creates a tenant session.
- Platform login separately verifies an active identity, active credential, and
  active platform membership before creating a platform session.
- Tenant middleware requires a tenant context and rejects platform tokens.
- Platform middleware requires a platform context and revalidates the platform
  session, identity, and membership.
- The frontend stores the server-provided context type and routes tenant
  sessions to `/dashboard` and platform sessions to `/platform`.
- No context selector or pending context-selection state currently exists.

Source code and tests are implementation evidence only. ADR-0040 and the
current roadmap remain authoritative outside this ADR's accepted scope.

## 4. Decision Details

The server authenticates the identity first, then resolves usable contexts
from authoritative database state. A raw membership-row count is not a
context count.

The decision does not introduce:

- a generic membership table;
- Organization;
- generic Location;
- tenant switching;
- branch-as-login-context.

Multiple active tenant memberships are distinct usable tenant contexts and
require login-time selection. This does not create post-login tenant
switching.

## 5. Usable Context Definition

A usable context is an application security context for which the
authenticated identity, membership, and associated state satisfy the
existing authoritative security and lifecycle rules.

### Tenant context

A tenant context is usable only when the complete authoritative chain is
valid, including as applicable:

- the authenticated identity is active;
- the login identifier is active and valid;
- the local credential is active and valid;
- the tenant membership is active;
- the tenant membership is not revoked or otherwise invalid;
- the associated tenant is in a valid state;
- the associated tenant user/account is active and valid;
- existing tenant authorization and security requirements are satisfied.

The current tenant login implementation relies heavily on tenant
user/login-identifier resolution and does not yet perform identity-wide
membership discovery. Future implementation must explicitly revalidate tenant
membership status and revocation during both direct context resolution and
final context selection. A raw `tenant_memberships` row does not by itself
create a usable context.

### Platform context

A platform context is usable only when the existing platform rules are
satisfied, including:

- the authenticated identity is active;
- the credential is active and valid;
- the platform membership is active;
- the platform membership is not revoked or otherwise invalid;
- associated platform state and authorization are valid.

No new membership statuses are defined by this ADR. Existing status,
revocation, identity, tenant, account, and platform authorization semantics
remain authoritative.

## 6. Direct vs Selection Resolution

### Zero contexts

The server fails safely with the existing authentication/account-state
conventions. It must not create a tenant session, platform session, or usable
application JWT, and must not unnecessarily disclose membership details.

### Exactly one context

The server creates the corresponding context-specific session and JWT:

- one tenant context -> tenant session -> `/dashboard`;
- one platform context -> platform session -> `/platform`.

### Multiple contexts

The server creates no tenant or platform application session before selection.
It returns only server-authorized context descriptors and short-lived pending
selection state. The user selects one displayed context, after which the
server re-resolves and revalidates the selected membership before creating
the appropriate session and JWT.

If the membership becomes inactive, revoked, stale, or otherwise unusable
between initial resolution and selection, selection fails closed.

## 7. Pending Selection Security

Pending selection state is not an application session and is not equivalent to
tenant or platform authentication. It must not be accepted as:

- tenant authentication;
- platform authentication;
- a tenant session;
- a platform session;
- a tenant JWT;
- a platform JWT;
- authorization for normal tenant or platform APIs;
- a PostgreSQL tenant RLS context;
- a value that sets or establishes `app.current_tenant_id`.

Pending selection state exists only to complete context selection. It does not
establish tenant authorization and must not cause any tenant RLS context to be
established. It must not bypass or weaken existing PostgreSQL RLS enforcement.

The state must be:

- short-lived;
- bound to the authenticated identity;
- single-use;
- expiry-bound;
- invalid after successful completion;
- invalid when the selected membership is no longer usable;
- incapable of authorizing normal application APIs.

The accepted implementation design uses a PostgreSQL-backed one-time challenge
with an opaque `challengeId.secret` token. The challenge identifier is a UUID;
the secret is 256-bit cryptographically secure random data. Only a secure
digest of the secret is persisted, and the plaintext secret exists only for
the response/transport lifecycle. The complete token must never be logged or
included in audit metadata. Knowing the challenge identifier without the
secret is insufficient.

The challenge is consumed atomically with a conditional update requiring the
matching digest, an unconsumed row, and an unexpired challenge. Concurrent
selection requests therefore permit exactly one successful consumption. If
final validation fails after consumption, the challenge remains consumed and
the user must authenticate again.

The challenge stores an internal JSONB security snapshot containing only the
minimum canonical state needed to bind the offered usable contexts and detect
relevant changes: identity security version; offered context type; and, for
tenant contexts, tenant membership ID, tenant ID, tenant user ID, tenant
membership security version, tenant security version, and tenant-user security
version; and, for platform contexts, platform membership ID, platform
membership security version, and platform security version. The snapshot is
server-side security state, is not client authorization, and is never returned
to the client. Implementations must serialize snapshot fields in a fixed
lexicographic field order with explicit JSON null/number/string types and a
canonical context ordering of context type followed by context identifier.
The snapshot is compared only after independently re-querying and validating
current authoritative state; it is never the sole authorization source.

## 8. Session Model

The architecture distinguishes:

1. **Authenticated identity state** — credentials are verified, but no
   application context has yet been entered.
2. **Pending context-selection state** — short-lived, identity-bound,
   non-authorizing state used only to complete selection.
3. **Tenant application session** — server-established tenant membership,
   tenant ID, optional branch/financial-year working context, and tenant JWT.
4. **Platform application session** — server-established platform membership,
   null tenant authorization context, platform JWT, and platform
   authorization.

The pending state must never be treated as either application session.

## 9. Tenant / Platform / Branch Boundaries

The existing hierarchy remains:

```text
Platform
  └── Tenant
       └── Branch
```

Tenant and platform sessions remain separate:

- a tenant JWT/session cannot satisfy platform authorization;
- a platform JWT/session cannot satisfy tenant authorization;
- a platform JWT does not establish tenant RLS context;
- platform authorization does not automatically grant tenant application
  access;
- PostgreSQL RLS remains the final tenant-isolation boundary;
- backend authorization remains authoritative.

Branch is a tenant-internal working context governed by ADR-0041. It is not a
login context, tenant, platform context, RLS boundary, or tenant-switching
mechanism. This ADR does not introduce branch selection during login.

## 10. API Direction

`POST /api/v1/auth/login` should evolve to perform credential authentication
plus identity-wide usable-context resolution.

The exact response schema remains an implementation-design concern. The
architectural behavior is:

- **DIRECT**: return the existing context-specific authentication/session
  result;
- **SELECT**: return only server-authorized context descriptors and
  short-lived pending selection state, with no usable application
  session/token;
- **ZERO**: return a safe failure without unnecessary account or membership
  enumeration.

A dedicated `POST /api/v1/auth/select-context` is appropriate for completing
selection. It should:

- accept only server-issued pending selection state/reference;
- treat a client-selected context reference only as a selection request;
- never trust client membership IDs as authorization;
- bind the request to the authenticated identity and pending state;
- re-resolve the selected context server-side;
- revalidate membership status, revocation, identity, and associated state;
- fail closed if the context changed;
- create the correct tenant or platform session;
- issue the appropriate context JWT.

The frontend must never become the authorization authority.

Post-authentication destinations must be server-controlled and allowlisted.
The only approved destinations are `/dashboard` for a tenant context and
`/platform` for a platform context. Client-controlled arbitrary redirect URLs,
external redirect targets, attacker-controlled return URLs, and
client-controlled navigation destinations that bypass these application routes
must not be accepted. The frontend may navigate based on the
server-authorized context result, but the destination mapping remains
constrained to these approved routes.

## 11. Platform Login Migration

`POST /api/v1/auth/platform-login` must not be removed by this ADR.

The recommended migration sequence is:

1. keep the existing endpoint functional for compatibility;
2. consolidate credential verification internally where appropriate;
3. reuse the context-specific platform session issuance path;
4. prove unified login;
5. deprecate the separate endpoint later through a separately governed
   change.

The repository does not establish external integrations, so no external
consumer is assumed. The long-term direction is one credential-authentication
path with context-specific session issuance.

## 12. Frontend UX

There is one login screen:

- tenant-only identity -> direct `/dashboard`;
- platform-only identity -> direct `/platform`;
- mixed tenant/platform identity -> selector;
- multiple usable tenant contexts -> selector;
- zero usable contexts -> safe error.

The frontend receives only server-authorized context descriptors. It must not:

- query membership tables directly;
- determine authorization locally;
- choose an arbitrary tenant;
- trust local storage, route parameters, or client-supplied context IDs;
- bypass server validation.

After selection, there is still no generic tenant-switching capability.

## 13. Security Invariants

This decision must not weaken existing controls. Implementations must preserve:

- authentication and authorization as separate concerns;
- server-authoritative identity-wide context resolution;
- explicit revalidation of inactive, revoked, or stale memberships;
- identity binding, expiry, single-use, and replay prevention for pending state;
- rejection of forged or altered context references;
- no usable application session before selection completes;
- pending selection state cannot establish tenant RLS context, set
  `app.current_tenant_id`, or weaken RLS enforcement;
- fail-closed behavior on zero contexts or changed membership state;
- server-controlled allowlisted post-auth destinations only; no arbitrary
  external redirect or client-controlled return URL;
- tenant/platform JWT and session separation;
- no platform-to-tenant privilege escalation;
- no tenant-to-platform privilege escalation;
- no authorization based on client-controlled identifiers;
- PostgreSQL RLS as tenant isolation enforcement;
- frontend state as UX only, never authorization authority.

## 14. Database Impact

The accepted implementation requires one additive migration for a dedicated
pre-session challenge table:

```sql
CREATE TABLE public.pending_login_challenges (
  challenge_id uuid PRIMARY KEY,
  identity_id uuid NOT NULL REFERENCES public.identities(id),
  secret_hash varchar(64) NOT NULL UNIQUE,
  context_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  CONSTRAINT pending_login_challenges_expiry_check
    CHECK (expires_at > created_at),
  CONSTRAINT pending_login_challenges_consumed_check
    CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);
```

The migration must add indexes for `(identity_id, expires_at)` and
unconsumed expiry lookup. It must grant `erp_app` only the operations the
repository uses: `INSERT`, `SELECT`, and `UPDATE`. It must not grant
`DELETE`, `TRUNCATE`, `REFERENCES`, or broad schema privileges. No sequence
privilege is required because `challenge_id` is supplied by the application.

This identity-wide pre-session table deliberately has no tenant RLS policy:
there is no tenant context before final selection. Access remains limited to
the application role and the pending-challenge repository boundary. The table
does not modify `user_sessions`, tenant RLS, platform sessions, or existing
security controls.

The implementation should prefer the existing:

- identities;
- authentication login identifiers;
- identity credentials;
- tenant memberships;
- platform memberships;
- tenant users/accounts;
- tenant sessions;
- platform sessions.

This ADR does not add a generic membership, Organization, or Location table.
The challenge table is not a generic membership or sessions table. It is the
minimum persistence required for true one-time, replay-protected,
multi-process-safe selection state.

## 15. Current Platform Administrator Example

The current local identity `platformadmin@magodfusion.in` has one active
platform membership, `platform_owner` authorization, and zero active tenant
memberships.

Under this accepted decision it therefore follows:

```text
authenticate
  -> exactly one usable context
  -> platform context
  -> create platform session
  -> redirect directly to /platform
```

No selector appears.

If the identity later has one usable tenant context and one usable platform
context:

```text
authenticate
  -> two usable contexts
  -> show selector
```

The selector displays only contexts authorized by the server.

## 16. Backward Compatibility

Existing tenant-only users continue to experience direct navigation to
`/dashboard` without an unnecessary selector.

Existing platform-login functionality remains functional during transition.
The current tenant session model, platform session model, branch working
context, tenant RLS, and platform authorization boundaries remain intact.

## 17. Testing Requirements

Future implementation must test at least:

1. one tenant membership -> direct tenant session;
2. one platform membership -> direct platform session;
3. tenant plus platform -> selector;
4. multiple tenant memberships -> selector;
5. zero usable contexts -> safe failure and no application session;
6. inactive tenant membership excluded;
7. revoked tenant membership excluded;
8. inactive/revoked platform membership excluded;
9. membership revoked between authentication and selection -> rejection;
10. forged, altered, expired, replayed, or identity-mismatched selection state
    rejected;
11. pending state cannot access tenant or platform APIs;
12. tenant session rejected by platform middleware;
13. platform session rejected by tenant middleware;
14. client tenant/platform identifiers cannot bypass server validation;
15. existing tenant administrator login remains direct;
16. current platform administrator reaches `/platform` directly;
17. legacy platform-login remains functional during migration;
18. refresh, logout, revocation, and security-version behavior remain
    context-specific.

## 18. ADR Relationship / Supersession

ADR-0042 does not edit ADR-0040 in place. It supersedes ADR-0040 only for:

- identity-wide usable-context resolution;
- login-time context selection;
- unified login UX;
- the relationship between normal login and platform login.

ADR-0040 remains authoritative for:

- Platform -> Tenant -> Branch hierarchy;
- tenant isolation;
- tenant/platform separation;
- PostgreSQL RLS;
- backend authority;
- prohibition of Organization and generic Location;
- branch not being a login context;
- session architecture except where this ADR explicitly adds login-time
  pending selection.

ADR-0041 remains unchanged and authoritative for branch working context and
branch authorization.

## 19. Roadmap Impact

ADR-0042 is accepted architecture. The roadmap should:

- move identity-wide usable-context resolution from deferred/retired to
  approved/planned work;
- add login-time context selection as approved/planned work;
- retain the prohibition on post-login tenant switching;
- retain branch working context as a separate capability;
- add the implementation sequence below;
- retain current tenant and platform login behavior as the implementation
  baseline until migration work is complete.

## 20. Future Implementation Sequence

Implementation is authorized but remains pending:

1. reconcile the roadmap and cross-references;
2. define the implementation contract for usable contexts from existing
   authoritative status and authorization rules;
3. implement identity-wide server-side context resolution;
4. add direct, select, and zero-context response handling;
5. add secure pending selection completion;
6. reuse existing tenant and platform session issuance paths;
7. add the unified Flutter selector and routing;
8. retain and internally consolidate `/auth/platform-login`;
9. add backend, frontend, integration, revocation, replay, and separation
   tests;
10. separately govern any later deprecation of `/auth/platform-login`.

## 21. Approval Requirement

This authentication-flow and session-management change has been accepted by
the Architecture Review Board. ADR-0042 authorizes implementation planning and
implementation of the bounded decision, but does not claim implementation
completion. No unrelated application, frontend, database, security-policy,
configuration, or deployment changes are authorized by this document.

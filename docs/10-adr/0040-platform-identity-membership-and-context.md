# ADR-0040: Platform Identity, Membership, and Context Architecture

**Date**: 2026-09-06  
**Status**: Approved  
**Approval Date**: 2026-09-06  
**Approved By**: Project Owner following final blocker-resolution review  
**Approval Basis**: Final blocker-resolution decision for the accepted one-identity, multi-membership direction  
**Scope**: Identity, credentials, tenant membership, platform administration, sessions, JWT context, platform database access, audit, RLS, bootstrap, and deployment

## Decision summary

The ERP uses one identity with independent tenant and platform memberships. A tenant membership is the authority for tenant context. A platform membership is the authority for platform context. Tenant roles and platform roles are separate permission domains. The API never treats a client-supplied tenant identifier as authorization.

This ADR supersedes the scoped identity, session, authorization, RLS, and audit decisions in ADR-0006 and ADR-0014 where they describe a tenant-only model. Existing tenant behavior remains valid until the additive implementation sequence below replaces it.

The repository has no production-data migration requirement. The implementation uses a clean development reset and deterministic reseed. The active development baseline is intentionally replaced by dependency-ordered Core, Customer, and Sales migrations; the historical migration chain remains recoverable from Git history and is not treated as the active chain.

## 1. Current repository evidence

The current implementation has:

- tenant-scoped `users` rows with `password_hash`, `tenant_id`, tenant defaults, and tenant-local username/email uniqueness;
- `auth_login_identifiers` mapping an identifier to `(tenant_id, user_id)`;
- tenant-scoped `user_sessions` with `tenant_id` and `user_id`;
- JWT claims containing `sub`, `tenantId`, and `sessionId`;
- tenant-only roles, role permissions, authorization, and RLS;
- tenant-owned append-only `audit_events` requiring non-null `tenant_id`;
- `UnitOfWork` and transaction-aware audit logging primitives;
- `tsx` scripts and `npm run db:migrate` for operational commands;
- local PostgreSQL supplied by `docker-compose.yml`;
- PostgreSQL CI provisioning a non-superuser, `NOBYPASSRLS` test role;
- Vercel configuration for the Flutter web output only; no Render or backend deployment manifest;
- no platform identity, membership, role, procedure, or bootstrap command.

The current `requirePlatformPermission` middleware is not a platform boundary. It checks a permission inside the current tenant and is replaced by the platform middleware defined here.

## 2. Identity and membership entities

### 2.1 `identities`

| Column | Type | Null | Default | Key/constraint |
|---|---|---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `status` | `identity_status_enum` | no | `active` | active/locked/disabled |
| `security_version` | `integer` | no | `1` | increments on credential compromise |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | yes | null | |
| `disabled_at` | `timestamptz` | yes | null | |

Indexes: `(status)`, `(security_version)`.

`identities` has no tenant RLS. It is accessed only by authentication and membership services through server-side repositories.

### 2.2 `identity_credentials`

| Column | Type | Null | Default | Key/constraint |
|---|---|---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `identity_id` | `uuid` | no | | FK `identities.id` |
| `provider` | `varchar(40)` | no | `'local'` | |
| `credential_type` | `varchar(40)` | no | `'password'` | |
| `secret_hash` | `varchar(255)` | no | | bcrypt/compatible hash |
| `status` | `credential_status_enum` | no | `active` | |
| `failed_attempt_count` | `integer` | no | `0` | |
| `locked_until` | `timestamptz` | yes | null | |
| `password_changed_at` | `timestamptz` | yes | null | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | yes | null | |

Unique: `(identity_id, provider, credential_type)`. Index: `(identity_id, status)`.

This permits future LDAP, AD, OIDC, and other providers without moving password columns again. Password reset and lockout state belong to the credential, not to a tenant projection.

### 2.3 `auth_login_identifiers`

The table remains the deployment-independent lookup boundary but changes ownership:

| Column | Type | Null | Default | Key/constraint |
|---|---|---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `identity_id` | `uuid` | no | | FK `identities.id` |
| `identifier_type` | `varchar(30)` | no | | username/email |
| `identifier` | `citext` | no | | normalized |
| `is_primary` | `boolean` | no | `false` | |
| `created_at` | `timestamptz` | no | `now()` | |

Unique: `(identifier_type, identifier)`. Index: `(identity_id, identifier_type)`.

An identifier is globally unique for an identity. A person with memberships in several tenants logs in once and then selects a server-returned membership context. Legacy duplicate identifiers are not silently merged; because this repository has no production-data requirement, the clean reset/reseed rejects duplicate legacy rows and requires deterministic fixture correction.

### 2.4 `tenant_memberships`

| Column | Type | Null | Default | Key/constraint |
|---|---|---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `identity_id` | `uuid` | no | | FK `identities.id` |
| `tenant_id` | `uuid` | no | | FK `tenants.id` |
| `status` | `membership_status_enum` | no | `active` | |
| `security_version` | `integer` | no | `1` | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | yes | null | |
| `revoked_at` | `timestamptz` | yes | null | |
| `revoked_by_identity_id` | `uuid` | yes | null | FK `identities.id` |

Unique: `(identity_id, tenant_id)`. Indexes: `(identity_id, status)`, `(tenant_id, status)`.

### 2.5 `platform_memberships`

| Column | Type | Null | Default | Key/constraint |
|---|---|---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `identity_id` | `uuid` | no | | FK `identities.id` |
| `status` | `membership_status_enum` | no | `active` | |
| `security_version` | `integer` | no | `1` | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | yes | null | |
| `revoked_at` | `timestamptz` | yes | null | |
| `revoked_by_identity_id` | `uuid` | yes | null | FK `identities.id` |

Unique partial index: one active membership per `identity_id`. Index: `(identity_id, status)`.

### 2.6 Existing `users`

`users` remains a tenant-account projection for compatibility:

- retain `users.id` as the stable tenant-account key referenced by tenant tables;
- retain `users.tenant_id`, tenant defaults, organization/branch/location state, tenant username/email display fields, and tenant lifecycle status;
- add non-null `users.identity_id` FK to `identities.id`;
- enforce unique `(identity_id, tenant_id)`;
- remove credential ownership from `users` after the reset migration; `password_hash` is copied to `identity_credentials` and then removed;
- retain a compatibility lookup from `(users.id, users.tenant_id)` to `tenant_memberships` until all services use membership IDs.

`users` is therefore not the canonical identity and is not discarded merely for compatibility.

## 3. Roles and permission domains

### 3.1 Tenant domain

Existing `roles`, `role_permissions`, `user_roles`, `user_permissions`, and permission catalog records remain tenant-scoped. Tenant membership replaces direct identity assumptions in authorization resolution, while `users.id` remains the compatibility account key during migration.

The authoritative tenant permissions are:

- `tenant.read`: view the currently selected tenant;
- `tenant.update`: update the currently selected tenant;
- `tenant.member.*` and `tenant.access.*`: administer members and access in the currently selected tenant.

### 3.2 Platform domain

Add a separate catalog namespace and tables:

- `platform.tenant.read`
- `platform.tenant.create`
- `platform.tenant.update`
- `platform.tenant.delete`
- `platform.tenant.activate`
- `platform.tenant.deactivate`
- `platform.tenant.suspend`
- `platform.tenant.reactivate`
- `platform.membership.*`
- `platform.role.*`
- `platform.audit.read`
- `platform.audit.export`

`platform_roles` contains `id`, `code`, `name`, `description`, `is_system`, `is_deleted`, timestamps, and version. `platform_permissions` contains the same catalog metadata shape as tenant permissions with platform-domain keys. `platform_role_permissions` has `(platform_role_id, platform_permission_id)` as a unique pair. `platform_membership_roles` has `(platform_membership_id, platform_role_id)` as a unique pair.

The old `tenant.create`, `tenant.delete`, and tenant lifecycle keys are deprecated compatibility keys. They are removed from tenant-role seed assignments and are not accepted by platform middleware. A compatibility migration maps them to the corresponding `platform.tenant.*` key only for an explicitly created platform-role assignment; no tenant role receives that mapping. `tenant.read` and `tenant.update` retain tenant semantics.

There is exactly one meaning for each key after the migration.

## 4. Authentication and login

1. Normalize the submitted identifier.
2. Resolve one `identity` through `auth_login_identifiers`.
3. Verify the submitted password against the active local credential for that identity.
4. Return the identity's active tenant memberships and platform membership metadata without granting any context.
5. Require the client to request one returned context through a server endpoint.
6. Validate that membership and tenant status server-side.
7. Create a context-bound session and issue tokens.

If the identifier is not globally unique, authentication fails closed. The implementation does not guess a tenant from a header, URL, body, hostname, or deployment setting.

The first successful login may default to the only active tenant membership. Multiple memberships require explicit context selection. Platform context is selected explicitly and is never inferred from tenant membership.

## 5. Session and JWT contract

### 5.1 `user_sessions` target columns

Retain the table name for compatibility and add:

| Column | Type | Null | Default | Constraint |
|---|---|---:|---|---|
| `identity_id` | `uuid` | no | | FK `identities.id` |
| `context_type` | `session_context_enum` | no | `'tenant'` | tenant/platform |
| `tenant_membership_id` | `uuid` | yes | null | FK `tenant_memberships.id` |
| `platform_membership_id` | `uuid` | yes | null | FK `platform_memberships.id` |
| `security_version` | `integer` | no | `1` | captured at issue |
| `tenant_id` | `uuid` | yes | null | compatibility/tenant context |
| `user_id` | `uuid` | yes | null | compatibility tenant account |

The existing organization, branch, location, token hash, expiry, revocation, and version columns remain.

The check constraint is:

```sql
(context_type = 'tenant'
 AND tenant_id IS NOT NULL
 AND tenant_membership_id IS NOT NULL
 AND platform_membership_id IS NULL
 AND user_id IS NOT NULL)
OR
(context_type = 'platform'
 AND tenant_id IS NULL
 AND tenant_membership_id IS NULL
 AND platform_membership_id IS NOT NULL
 AND user_id IS NULL)
```

Indexes: `(identity_id, is_active)`, `(tenant_membership_id, is_active)`, `(platform_membership_id, is_active)`, and the existing refresh-token index.

### 5.2 JWT

Access and refresh claims become:

```text
sub          = identity_id
sessionId    = session id
contextType  = tenant | platform
tenantId     = selected tenant UUID for tenant context only
membershipId = selected tenant or platform membership UUID
tokenType
iss, iat, exp
```

`tenantId` is informational context carried by a validated token, never the authorization source. Middleware loads the session by `sessionId`, verifies identity and membership security versions, and derives tenant/platform context from the session row.

### 5.3 Context switching

Context switching creates a new session and rotates both access and refresh tokens. The prior session is revoked with reason `context_switch`. The client cannot switch by changing `tenantId`.

### 5.4 Revocation

- Tenant membership revoked: revoke sessions whose `tenant_membership_id` matches; other tenant and platform sessions remain valid.
- Platform membership revoked: revoke sessions whose `platform_membership_id` matches; tenant sessions remain valid.
- Tenant suspended/deleted: revoke or reject all sessions for that tenant membership.
- Credential compromise: increment `identities.security_version` and revoke all identity sessions.
- Role changes: authorization is resolved on every protected request; no token permission cache is authoritative.

## 6. PostgreSQL roles and procedures

The application uses two configured database URLs after implementation:

### `erp_app`

| Attribute | Value |
|---|---|
| LOGIN | yes |
| SUPERUSER | no |
| CREATEDB | no |
| CREATEROLE | no |
| REPLICATION | no |
| BYPASSRLS | no |
| Table privileges | existing tenant CRUD privileges only |
| Sequence privileges | existing application sequence privileges |
| Function privileges | no platform procedure execution |

### `erp_platform_executor`

| Attribute | Value |
|---|---|
| LOGIN | yes, separate secret |
| SUPERUSER | no |
| CREATEDB | no |
| CREATEROLE | no |
| REPLICATION | no |
| BYPASSRLS | no |
| Table privileges | none |
| Sequence privileges | none |
| Function privileges | `EXECUTE` only on named platform procedures |

### `erp_procedure_owner`

| Attribute | Value |
|---|---|
| LOGIN | no |
| SUPERUSER | no |
| CREATEDB | no |
| CREATEROLE | no |
| REPLICATION | no |
| BYPASSRLS | no |
| Table privileges | ownership/explicit privileges required by the named procedures |
| Sequence privileges | ownership/explicit privileges required by the named procedures |
| Function privileges | owns the named procedures; `EXECUTE` revoked from `PUBLIC` |

`erp_platform_executor` is provisioned outside application migrations by the database owner. The platform service uses a separate pool configured with `PLATFORM_DATABASE_URL`. The normal application pool never receives these credentials.

### 6.1 Controlled procedures

Only these operations use platform procedures:

1. `platform_create_tenant(...)`
2. `platform_transition_tenant(target_tenant_id, transition, actor_identity_id, correlation_id, metadata)`
3. `platform_delete_tenant(target_tenant_id, actor_identity_id, correlation_id, metadata)` only for the existing guarded soft-delete semantics.
4. `platform_create_membership(...)`, `platform_revoke_membership(...)`, and platform role assignment procedures.

Procedures use fixed parameters, fixed SQL, `LANGUAGE plpgsql`, and `SET search_path = pg_catalog, public`. They accept no table names, SQL, or arbitrary context settings. They validate UUID existence, lifecycle transition legality, protected-tenant rules, and actor/event inputs.

Each procedure runs inside the caller's transaction. The platform service begins `BEGIN`, invokes one procedure, writes the platform audit event on the same platform connection, and commits once. Failure rolls back both mutation and audit.

RLS on affected tenant tables remains `FORCE ROW LEVEL SECURITY`. The platform operation policy permits only the named operation when `session_user = 'erp_platform_executor'` and a procedure-set, operation-specific transaction-local marker matches the fixed procedure. The marker is not accepted as an API parameter. There is no generic RLS bypass and no `SET row_security = off`.

## 7. Audit model

### 7.1 `audit_events`

The existing table is extended additively:

| Column | Type | Null | Default | Constraint |
|---|---|---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `actor_identity_id` | `uuid` | no for authenticated events | | FK `identities.id` |
| `actor_membership_id` | `uuid` | yes | null | tenant/platform membership FK |
| `context_type` | `audit_context_enum` | no | `'tenant'` | tenant/platform |
| `tenant_id` | `uuid` | yes | null | FK `tenants.id` `ON DELETE SET NULL` |
| `target_tenant_id` | `uuid` | yes | null | FK `tenants.id` `ON DELETE SET NULL` |
| `actor_user_id` | `uuid` | yes | null | compatibility FK |
| `action` | `varchar(160)` | no | | |
| `resource_type` | `varchar(120)` | no | | |
| `resource_id` | `varchar(255)` | yes | null | |
| `permission` | `varchar(160)` | yes | null | canonical key |
| `outcome` | `varchar(16)` | no | | success/failure |
| `correlation_id` | `varchar(255)` | yes | null | |
| `metadata` | `jsonb` | no | `'{}'` | allowlisted |
| `created_at` | `timestamptz` | no | `now()` | |

Tenant action:

```text
context_type = tenant
tenant_id = actor tenant
target_tenant_id = NULL
actor_membership_id = tenant membership
```

Platform action:

```text
context_type = platform
tenant_id = NULL
target_tenant_id = target or NULL
actor_membership_id = platform membership
```

Unauthenticated failures use `actor_identity_id = NULL` and are retained only for events already supported by the current security policy.

Indexes: `(tenant_id, created_at DESC)`, `(target_tenant_id, created_at DESC)`, `(actor_identity_id, created_at DESC)`, `(context_type, created_at DESC)`, and `(resource_type, resource_id, created_at DESC)`.

Tenant foreign keys use `ON DELETE SET NULL`; audit history survives tenant soft deletion and physical tenant deletion. Tenant deletion remains blocked while tenant-owned business data exists, but audit rows do not prevent a governed physical purge. A purge records a platform audit event before deletion and retains the resulting platform event without a tenant FK.

### 7.2 Audit RLS and visibility

- Tenant application role can select rows with `context_type = 'tenant'` and `tenant_id = app.current_tenant_id`.
- Tenant application role cannot select `context_type = 'platform'`, including rows whose `target_tenant_id` equals the active tenant.
- Platform executor can select platform rows only when the platform service sets the validated platform-read transaction marker and uses an authorized platform permission.
- Platform executor may select tenant rows only when the endpoint has explicit `platform.audit.read.tenant` authorization and supplies a validated target tenant ID.
- Inserts are allowed only through the audit logger inside the current mutation transaction; append-only update/delete triggers remain.

Audit reads are never authorized by `target_tenant_id` alone.

## 8. First platform administrator

### 8.1 Command

Add the operational command through the existing `tsx` script tooling:

```text
npm exec tsx scripts/platform-admin.ts bootstrap
```

The script reads the configured `DATABASE_URL` for identity/bootstrap metadata and `PLATFORM_DATABASE_URL` for platform procedure execution. It is not an HTTP endpoint and is not registered in Fastify.

### 8.2 Secret and replay protection

`PLATFORM_ADMIN_BOOTSTRAP_SECRET` is supplied by the deployment secret manager or local `.env.local`, must contain at least 32 random characters, is never stored or logged, and is removed from the environment after successful use.

The command succeeds only when no active platform membership exists. A unique partial index and a transaction-level advisory lock on a fixed bootstrap key serialize concurrent attempts. Wrong secrets fail before mutation. A second execution fails with an already-initialized result. All failures are rate-limited by the operator environment and never reveal credential state.

The transaction creates identity, local credential, platform membership, protected `platform_owner` role, role assignment, and one platform audit event. Any error rolls back everything.

### 8.3 Recovery

Recovery is a deployment-operator action, not an API action:

```text
npm exec tsx scripts/platform-admin.ts recover
```

It requires a separately stored `PLATFORM_ADMIN_RECOVERY_SECRET`, a target email supplied interactively or through a non-secret argument, and an explicit confirmation flag. It acquires the same bootstrap lock, revokes all existing platform memberships, creates one new platform membership and protected owner assignment, increments affected identity security versions, and records a platform recovery audit event in one transaction. The recovery secret is rotated and unset after use. Tenant authorization cannot invoke the command because it is not exposed through the application.

## 9. Deployment contract

### Local development

- `docker-compose.yml` continues to provide PostgreSQL infrastructure.
- The database owner provisions `erp_app`, `erp_platform_executor`, and `erp_procedure_owner`; credentials are supplied through `.env.local`.
- `npm run db:migrate` applies additive migrations.
- A clean local database is seeded with reference data.
- The operator runs the bootstrap command once.

### CI

The existing workflow creates a non-superuser `NOBYPASSRLS` test role. The implementation extends the CI setup step to create the three roles with ephemeral credentials, applies procedure grants, runs migrations, and runs the bootstrap command with a generated one-time secret. CI explicitly verifies role attributes and procedure execution boundaries.

### Render

This repository contains no Render backend manifest. Production provisioning therefore uses Render's managed PostgreSQL owner credentials in a one-time operator shell/job:

1. provision the three roles and grants through the database owner connection;
2. set `DATABASE_URL` to `erp_app` and `PLATFORM_DATABASE_URL` to `erp_platform_executor`;
3. deploy the backend container;
4. run `npm exec tsx scripts/platform-admin.ts bootstrap` as a Render one-off job with the bootstrap secret;
5. unset the bootstrap secret after success.

Application startup never creates roles, databases, users, or credentials.

## 10. Migration sequence

The active development migration history is a clean baseline, not a production-data upgrade chain. Historical migrations 0000–0057 remain available in Git history for reconstruction and comparison. The active baseline is dependency ordered:

1. **0000_core_platform**: shared platform, identity, memberships, authorization, audit, tenant context, security functions, and RLS infrastructure.
2. **0001_customer**: the implemented Customer-domain persistence and its tenant/organization security.
3. **0002_sales**: implemented Sales persistence and its transaction-supporting dependencies, after Core and Customer.

Each migration is applied transactionally from an empty development database. No later-domain object may be required by an earlier migration. Production-data compatibility is not required for this development-only replacement; production recovery remains restore/forward-compensation governed by ADR-0007.

1. **Identity base**: create enums, `identities`, and `identity_credentials`.
2. **Memberships**: create `tenant_memberships` and `platform_memberships`, then add `users.identity_id`.
3. **Login lookup**: replace `auth_login_identifiers` ownership with `identity_id`; copy one identity and credential per deterministic seed account; reject duplicate legacy identifiers rather than merging.
4. **Platform catalog**: create platform permissions, roles, role-permission links, and membership-role links; seed the platform namespace; map deprecated global tenant lifecycle keys only to platform roles.
5. **Sessions**: add context and membership columns/check constraints to `user_sessions`; backfill tenant sessions from memberships; add security-version columns and indexes.
6. **Audit extension**: add actor identity, membership, context, target tenant, and permission columns; backfill existing rows as tenant-context events; convert `tenant_id` to nullable; replace actor FK and tenant-only indexes.
7. **RLS**: update tenant policies, add platform operation policies, and add audit visibility policies while keeping `FORCE ROW LEVEL SECURITY`.
8. **Procedures and grants**: provision external roles, create fixed procedures, revoke `PUBLIC` execution, and grant only named procedure execution to `erp_platform_executor`.
9. **Compatibility cleanup**: remove password columns from `users`, remove deprecated tenant lifecycle keys from tenant-role seed data, and remove direct tenant-ID authorization paths after all services use validated session membership.

Because there is no production-data obligation, development and CI use a database reset before the new migration chain and deterministic reseed. The old schema is not migrated in-place in production by this project.

## 11. API and middleware contract

### Tenant APIs

`/tenants/current/*` use:

```text
JWT → session validation → tenant membership validation → tenant context → tenant permission → org/branch/location scope → RLS
```

### Platform APIs

`/platform/tenants/*`, `/platform/members/*`, `/platform/roles/*`, and `/platform/security/*` use:

```text
JWT → platform session validation → platform membership validation
    → platform permission → target validation
    → platform procedure/platform transaction → platform audit → commit
```

Required platform endpoint contract:

| Endpoint | Context | Permission | Target | Database path | Audit |
|---|---|---|---|---|---|
| `POST /platform/tenants` | platform | `platform.tenant.create` | new tenant | tenant bootstrap + platform procedure | platform tenant.created |
| `GET /platform/tenants` | platform | `platform.tenant.read` | none | platform read transaction | none |
| `PATCH /platform/tenants/:tenantId` | platform | `platform.tenant.update` | validated tenant UUID | platform procedure | platform tenant.updated |
| `POST /platform/tenants/:tenantId/activate` | platform | `platform.tenant.activate` | validated tenant UUID | platform procedure | platform tenant.activated |
| `POST /platform/tenants/:tenantId/deactivate` | platform | `platform.tenant.deactivate` | validated tenant UUID | platform procedure | platform tenant.deactivated |
| `POST /platform/tenants/:tenantId/suspend` | platform | `platform.tenant.suspend` | validated tenant UUID | platform procedure | platform tenant.suspended |
| `POST /platform/tenants/:tenantId/reactivate` | platform | `platform.tenant.reactivate` | validated tenant UUID | platform procedure | platform tenant.reactivated |
| `DELETE /platform/tenants/:tenantId` | platform | `platform.tenant.delete` | validated tenant UUID | guarded platform procedure | platform tenant.deleted |

Platform administration does not grant customer, inventory, sales, procurement, finance, HR, or reporting permissions.

## 12. Implementation sequence

1. Add identity, credential, membership, and session contracts and migrations.
2. Add repository/authentication support for identity login and explicit context selection.
3. Add platform catalog, roles, membership authorization, and middleware.
4. Add platform database role provisioning and fixed procedures.
5. Extend audit contracts/logger/schema and move security mutations plus audit into one `UnitOfWork`.
6. Add first-admin bootstrap and recovery commands.
7. Add platform APIs and tenant lifecycle integration.
8. Add Flutter platform context and administration surfaces.
9. Remove compatibility credential and deprecated permission paths.
10. Run the complete security, RLS, audit, bootstrap, backend, and Flutter validation contract.

## 13. Required tests

The implementation is incomplete until tests prove:

- one identity can have two tenant memberships and an independent platform membership;
- duplicate memberships and duplicate global identifiers are rejected;
- local credential verification and explicit context selection work;
- tenant A sessions cannot access tenant B;
- membership, platform, tenant lifecycle, and credential-compromise revocation semantics hold;
- tenant roles cannot grant platform permissions and platform roles cannot grant tenant business permissions;
- client tenant-ID manipulation fails;
- application role is `NOSUPERUSER NOBYPASSRLS`;
- unauthorized platform procedure execution fails;
- procedures accept no arbitrary SQL/table/context input;
- tenant RLS remains isolated;
- tenant mutation plus audit and platform mutation plus audit commit atomically;
- forced audit failure rolls back the mutation;
- tenant users cannot read platform events;
- platform users require explicit permission for tenant audit reads;
- first bootstrap succeeds once, rejects wrong/replayed/concurrent attempts, rolls back on failure, and cannot be invoked by tenant APIs;
- recovery revokes old platform sessions and creates exactly one replacement owner context;
- local, CI, and deployment role provisioning is reproducible.

## 14. Security invariants

1. Identity is not a tenant.
2. Membership determines operating context.
3. Roles determine permitted actions within that membership.
4. Client tenant IDs never authorize.
5. Platform membership is independent of tenant membership.
6. Tenant roles cannot grant platform authority.
7. Platform roles do not grant tenant business authority.
8. No application role has `BYPASSRLS`.
9. Platform procedures are fixed, narrow, and non-dynamic.
10. Tenant RLS remains enforced for normal requests and controlled platform operations.
11. Platform audit is not tenant-owned because it targets a tenant.
12. Security mutation and audit share one transaction.
13. Membership revocation invalidates only its context.
14. First-admin creation is operator-controlled, one-time, and unavailable through HTTP.

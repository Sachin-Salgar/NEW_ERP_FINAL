# API Versioning Implementation

**Related decision:** ADR-0024 — API Versioning Strategy  
**Current major version:** `v1`  
**Status:** Implemented policy baseline; runtime validation pending

## Current Contract

The backend exposes versioned application routes beneath the configured API prefix. The supported production major version is currently:

```text
/api/v1
```

`API_PREFIX` remains deployment configuration, but supported API majors are product contracts. Deployments must not use the configuration value to invent an undocumented public major version.

## Compatibility Rules

Within `v1`, changes must remain backward compatible for documented clients. Compatible changes include additive optional response fields, new endpoints, new optional request fields, and new enum values only when the consuming contract explicitly permits forward-compatible enum handling.

The following are breaking and require a new major version unless an explicitly documented compatibility mechanism exists:

- removing or renaming a field;
- changing field meaning or type;
- making an optional request field required;
- changing authentication/session semantics in a way that breaks existing clients;
- changing pagination/error/content-type contracts incompatibly;
- removing an endpoint or changing its HTTP method/path;
- changing authorization behavior from an established documented contract in a way that invalidates legitimate existing clients.

## Major-Version Introduction

A future `v2` must be introduced as a separate route namespace. Existing `v1` routes remain registered during an approved migration window. The application must not mechanically rewrite all `v1` paths to `v2`; each changed contract requires an explicit migration mapping.

The rollout sequence is:

1. define the `v2` contract and OpenAPI document;
2. document `v1` → `v2` request/response/authentication differences;
3. run both versions concurrently where required;
4. publish deprecation metadata and client migration guidance;
5. observe client adoption and operational errors;
6. sunset `v1` only after the approved compatibility window;
7. remove obsolete implementation after the sunset date.

## Deprecation Metadata

When an API version or endpoint is formally deprecated, responses should use standards-oriented metadata where applicable:

- `Deprecation` — communicates that the resource/version is deprecated;
- `Sunset` — communicates the planned retirement date when one has been approved;
- `Link` — points to migration or successor documentation when available.

A route must not emit a speculative sunset date. The date becomes part of the compatibility commitment once published.

## OpenAPI

Each concurrently supported major version has an independently consumable OpenAPI contract. Shared schemas may be generated from common source definitions internally, but the published `v1` contract cannot silently mutate to describe `v2` behavior.

## Cross-Cutting Contracts

The following are versioned API behavior and must be considered when introducing a new major:

- authentication and refresh-token exchange;
- tenant/session context;
- authorization failures;
- request validation;
- RFC 7807 negotiation;
- pagination envelopes and query parameters;
- content types;
- correlation/request identifiers;
- rate-limit behavior relevant to clients.

## Current Migration Assessment

No `v2` contract currently exists, so there is no justified route duplication or version sunset to implement. The existing `v1` namespace remains authoritative. Future breaking changes must follow the sequence above rather than modifying `v1` in place.

## Validation

Before marking the versioning item fully verified:

- confirm all public runtime application routes are under the intended `v1` prefix;
- confirm Swagger/OpenAPI URLs describe the same runtime paths;
- confirm deployment configuration cannot silently expose an unsupported major as a documented product contract;
- add compatibility tests before the first `v2` route is introduced.

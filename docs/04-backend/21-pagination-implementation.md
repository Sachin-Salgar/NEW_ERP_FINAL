# API Pagination Implementation

## Purpose

This document records the implementation of the pagination contract defined by `docs/04-backend/06-api-design-standards.md`.

## Query Contract

List endpoints use the standard query parameters:

- `page`: 1-based positive integer; defaults to `1` when pagination is requested.
- `page_size`: positive integer; maximum `100`; defaults to `20` when pagination is requested.
- `sort`: endpoint-specific sortable field.
- `order`: `asc` or `desc`; defaults to `asc`.
- `search`: optional free-text search across endpoint-defined searchable fields.

`limit` and `cursor` are not part of this contract.

## Response Metadata

When pagination parameters are supplied, list responses include `metadata` containing:

- `page`
- `page_size`
- `total`
- `total_pages`
- `sort` when supplied
- `order`
- `search` when supplied

Existing response envelopes are preserved; only the list collection and pagination metadata are added/changed.

## Current Endpoints

The shared pagination response hook supports the primary list collections exposed by the platform:

- organizations
- branches
- locations
- users
- RBAC roles
- RBAC permissions
- authentication modules

RBAC roles and permissions use the route-level implementation so their list handlers explicitly own the pagination behavior.

## Security and Compatibility

Pagination is applied after the existing tenant-scoped service/repository authorization has produced the collection. No tenant, organization, branch, or permission checks are bypassed by pagination.

Pagination is opt-in when a pagination-related query parameter is present, preserving existing clients that do not yet send pagination parameters.

## Follow-up

The current platform implementation establishes the public API contract and bounded response size. Repository-level SQL `LIMIT/OFFSET` or keyset retrieval may be introduced later for very large datasets, provided it remains aligned with the same public query contract and tenant/RLS guarantees.

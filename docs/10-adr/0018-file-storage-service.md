# ADR-0018: File Storage Service

**Date**: 2026-09-04  
**Status**: Proposed  
**Scope**: ERP-managed file and attachment storage

## Context

ERP modules will generate and attach documents, images, exports, and other files. File content should not be stored directly in transactional PostgreSQL tables, and application code should not depend on a single storage vendor.

## Decision

Introduce a provider-neutral File Storage Service backed by object storage.

1. Store file bytes in S3-compatible object storage; store authoritative metadata and ownership in PostgreSQL.
2. Expose an application `FileStorageService` contract so modules do not construct provider-specific object-store calls.
3. Every stored object receives an opaque identifier and tenant-aware ownership metadata. Object keys must not be derived solely from user-controlled filenames.
4. Access is authorized by ERP ownership/permission checks before issuing a bounded download or upload capability.
5. Prefer short-lived signed URLs or equivalent controlled transfer mechanisms for large files rather than proxying all bytes through the application.
6. Persist file metadata such as size, MIME type, checksum, original filename, storage key, creator, tenant, and lifecycle state.
7. File deletion follows the ERP soft-delete/lifecycle policy; physical purge is a separate controlled operation.
8. Provider credentials remain outside application data and are supplied through deployment configuration/secret management.

## Rationale

Object storage scales independently of the transactional database and is available from multiple vendors and on-premises implementations. PostgreSQL remains authoritative for business ownership and authorization.

## Alternatives Considered

- **Store binary data in PostgreSQL** — rejected for the primary ERP file path because it couples database growth to large binary payloads.
- **Local application filesystem** — rejected for clustered and portable deployments.
- **Direct vendor SDK usage in modules** — rejected because it creates infrastructure coupling.

## Consequences

- Adds an object-storage dependency and lifecycle management.
- Enables scalable attachments and portable deployment.
- Requires explicit authorization, retention, and cleanup handling.

## Implementation Notes

Add file-type/size policy enforcement before accepting uploads. Integrity checksums should be calculated on the stored object. Security scanning can be introduced as a policy/adapter without changing the domain contract.

## Related Documents

- `docs/03-database/11-multi-tenancy.md`
- `docs/03-database/18-lifecycle-governance.md`

# ADR-0030: Sales Credit Note Minimum Policy

**Date:** 2026-09-05  
**Status:** Approved for initial Sales Credit Note implementation

## Decision

Sales Credit Notes are created only from a `PROCESSED` Sales Return in the
authenticated tenant, organization, branch, and financial-year context. The
credit note snapshots the return lines and permits one credit note per return.
The lifecycle is `DRAFT -> ISSUED` or `DRAFT -> CANCELLED`; issued notes are
immutable.

Finance posting and Tax calculation are not connected in the repository.
Provider status fields remain `NOT_CONNECTED`, with no direct writes to
Finance/Tax data.
